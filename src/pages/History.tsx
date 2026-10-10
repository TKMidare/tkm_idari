import { useEffect, useState } from 'react'
import { entities, formatValue, type Values } from '../lib/fields'
import { formatDateTime } from '../lib/format'
import { PAGE_SIZE, describeError } from '../lib/records'
import { supabase } from '../lib/supabase'

interface Entry {
  id: number
  table_name: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Values | null
  new_data: Values | null
  user_email: string | null
  created_at: string
}

const ACTIONS = {
  INSERT: { label: 'Eklendi', badge: 'badge badge-ok' },
  UPDATE: { label: 'Güncellendi', badge: 'badge badge-warning' },
  DELETE: { label: 'Silindi', badge: 'badge badge-danger' },
}

function Changes({ entry }: { entry: Entry }) {
  const entity = entities.find((candidate) => candidate.table === entry.table_name)
  if (!entity || entry.action !== 'UPDATE') return null

  const changed = entity.fields.filter((field) => entry.old_data?.[field.key] !== entry.new_data?.[field.key])
  return (
    <ul className="changes">
      {changed.map((field) => (
        <li key={field.key}>
          <strong>{field.label}:</strong> {formatValue(field, entry.old_data?.[field.key] ?? null) || '(boş)'} →{' '}
          {formatValue(field, entry.new_data?.[field.key] ?? null) || '(boş)'}
        </li>
      ))}
    </ul>
  )
}

export function History() {
  const [table, setTable] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ entries: Entry[]; total: number } | null>(null)
  const [failure, setFailure] = useState('')

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  useEffect(() => {
    let stale = false
    let query = supabase.from('audit_log').select('*', { count: 'exact' })
    if (table) query = query.eq('table_name', table)
    query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .then(({ data: entries, count, error }) => {
        if (stale) return
        if (error) setFailure(describeError(error))
        else setData({ entries: entries as Entry[], total: count ?? 0 })
      })
    return () => {
      stale = true
    }
  }, [table, page])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Değişiklik Geçmişi</h1>
          <p className="muted">Kim, neyi, ne zaman değiştirdi</p>
        </div>
      </header>

      <div className="toolbar">
        <select
          aria-label="Kayıt türü"
          value={table}
          onChange={(event) => {
            setTable(event.target.value)
            setPage(0)
          }}
        >
          <option value="">Tüm kayıt türleri</option>
          {entities.map((entity) => (
            <option key={entity.table} value={entity.table}>
              {entity.title}
            </option>
          ))}
        </select>
      </div>

      {failure && <p className="alert alert-error">{failure}</p>}

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>Kayıt</th>
                <th>İşlem</th>
                <th>Değişiklikler</th>
              </tr>
            </thead>
            <tbody>
              {data?.entries.map((entry) => {
                const entity = entities.find((candidate) => candidate.table === entry.table_name)
                const record = entry.new_data ?? entry.old_data
                return (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.created_at)}</td>
                    <td>{entry.user_email ?? '—'}</td>
                    <td>
                      {entity && record ? formatValue(entity.fields[0], record[entity.keyField]) : '—'}
                      <span className="muted"> · {entity?.singular ?? entry.table_name}</span>
                    </td>
                    <td>
                      <span className={ACTIONS[entry.action].badge}>{ACTIONS[entry.action].label}</span>
                    </td>
                    <td>
                      <Changes entry={entry} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!data && !failure && <p className="empty">Yükleniyor…</p>}
          {data?.entries.length === 0 && <p className="empty">Henüz kayıtlı bir değişiklik yok.</p>}
        </div>
        <footer className="pager">
          <span className="muted">
            Sayfa {page + 1} / {pageCount}
          </span>
          <button type="button" className="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Önceki
          </button>
          <button type="button" className="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>
            Sonraki
          </button>
        </footer>
      </div>
    </>
  )
}
