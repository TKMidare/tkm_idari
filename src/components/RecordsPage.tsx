import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { downloadExcel } from '../lib/excel'
import { STATUS_OPTIONS, formatValue, type Entity, type Field, type Row } from '../lib/fields'
import { EXPIRY_WARNING_DAYS, daysUntil } from '../lib/format'
import { PAGE_SIZE, deleteRecord, fetchAll, fetchPage, type Sort } from '../lib/records'
import { ImportDialog } from './ImportDialog'
import { Modal } from './Modal'
import { RecordForm } from './RecordForm'

type Dialog = { kind: 'form'; row: Row | null } | { kind: 'delete'; row: Row } | { kind: 'import' } | null

function cellClass(field: Field, row: Row): string | undefined {
  const value = row[field.key]
  if (!field.expiry || !value || row.status !== 'Aktif') return undefined
  const days = daysUntil(String(value))
  return days < 0 ? 'cell-expired' : days <= EXPIRY_WARNING_DAYS ? 'cell-expiring' : undefined
}

export function RecordsPage({ entity }: { entity: Entity }) {
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [filters, setFilters] = useState({ term: search, status: '' })
  const [sort, setSort] = useState<Sort>({ key: entity.keyField, ascending: true })
  const [page, setPage] = useState(0)
  const [version, setVersion] = useState(0)
  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  const columns = entity.fields.filter((field) => !field.hidden)
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.term === search.trim() ? current : { ...current, term: search.trim() }))
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let stale = false
    setLoading(true)
    fetchPage(entity, filters, sort, page)
      .then((result) => {
        if (stale) return
        // Son sayfadaki son kayıt silindiyse bir önceki sayfaya dön.
        if (result.rows.length === 0 && page > 0) setPage(page - 1)
        else setData(result)
      })
      .catch((error: Error) => !stale && setNotice({ kind: 'error', text: error.message }))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [entity, filters, sort, page, version])

  function changed(text: string) {
    setDialog(null)
    setNotice({ kind: 'success', text })
    setVersion((current) => current + 1)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      setDialog(null)
      setNotice({ kind: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const exportAll = () =>
    run(async () => downloadExcel(entity, await fetchAll(entity, filters), entity.table))

  const confirmDelete = (row: Row) =>
    run(async () => {
      await deleteRecord(entity, row.id)
      changed(`${formatValue(entity.fields[0], row[entity.keyField])} silindi.`)
    })

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{entity.title}</h1>
          <p className="muted">{data ? `${data.total.toLocaleString('tr-TR')} kayıt` : ' '}</p>
        </div>
        <div className="actions">
          <button type="button" className="button" onClick={() => setDialog({ kind: 'import' })}>
            Excel'den Aktar
          </button>
          <button type="button" className="button" onClick={exportAll} disabled={busy || !data?.total}>
            Excel'e İndir
          </button>
          <button type="button" className="button button-primary" onClick={() => setDialog({ kind: 'form', row: null })}>
            + {entity.singular} Ekle
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Ara…"
          aria-label="Ara"
          value={search}
          maxLength={60}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Durum filtresi"
          value={filters.status}
          onChange={(event) => {
            setFilters((current) => ({ ...current, status: event.target.value }))
            setPage(0)
          }}
        >
          <option value="">Tüm durumlar</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      {notice && (
        <p className={`alert alert-${notice.kind}`} role="status">
          {notice.text}
          <button type="button" className="icon-button" aria-label="Kapat" onClick={() => setNotice(null)}>
            ×
          </button>
        </p>
      )}

      <div className="table-card">
        <div className="table-scroll" aria-busy={loading}>
          <table>
            <thead>
              <tr>
                {columns.map((field) => (
                  <th key={field.key} aria-sort={sort.key !== field.key ? undefined : sort.ascending ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      onClick={() => {
                        setSort({ key: field.key, ascending: sort.key === field.key ? !sort.ascending : true })
                        setPage(0)
                      }}
                    >
                      {field.label}
                      <span className="sort-mark">{sort.key !== field.key ? '' : sort.ascending ? '▲' : '▼'}</span>
                    </button>
                  </th>
                ))}
                <th className="col-actions">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((field) => (
                    <td key={field.key} className={cellClass(field, row)}>
                      {field.key === 'status' ? (
                        <span className={row.status === 'Aktif' ? 'badge badge-ok' : 'badge'}>{row.status}</span>
                      ) : field.key === entity.keyField ? (
                        <button type="button" className="link-button" onClick={() => setDialog({ kind: 'form', row })}>
                          {formatValue(field, row[field.key])}
                        </button>
                      ) : (
                        <span className={field.type === 'textarea' ? 'clip' : undefined} title={field.type === 'textarea' ? String(row[field.key] ?? '') : undefined}>
                          {formatValue(field, row[field.key])}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="col-actions">
                    <button type="button" className="link-button" onClick={() => setDialog({ kind: 'form', row })}>
                      Düzenle
                    </button>
                    <button type="button" className="link-button text-danger" onClick={() => setDialog({ kind: 'delete', row })}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && loading && <p className="empty">Yükleniyor…</p>}
          {data?.rows.length === 0 && (
            <p className="empty">
              {filters.term || filters.status
                ? 'Aramanızla eşleşen kayıt bulunamadı.'
                : `Henüz kayıt yok. "+ ${entity.singular} Ekle" ile ilk kaydı oluşturun.`}
            </p>
          )}
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

      {dialog?.kind === 'form' && (
        <RecordForm
          entity={entity}
          row={dialog.row}
          onClose={() => setDialog(null)}
          onSaved={() => changed(dialog.row ? 'Değişiklikler kaydedildi.' : `${entity.singular} eklendi.`)}
        />
      )}
      {dialog?.kind === 'import' && (
        <ImportDialog
          entity={entity}
          onClose={() => setDialog(null)}
          onImported={(count) => changed(`${count} kayıt aktarıldı.`)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <Modal title={`${entity.singular} Sil`} onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p>
              <strong>{formatValue(entity.fields[0], dialog.row[entity.keyField])}</strong> kaydı kalıcı olarak
              silinecek. Silinen kayıt Değişiklik Geçmişi'nde görünmeye devam eder.
            </p>
          </div>
          <footer className="modal-footer">
            <button type="button" className="button" onClick={() => setDialog(null)}>
              Vazgeç
            </button>
            <button type="button" className="button button-danger" disabled={busy} onClick={() => confirmDelete(dialog.row)}>
              Sil
            </button>
          </footer>
        </Modal>
      )}
    </>
  )
}
