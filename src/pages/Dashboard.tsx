import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { entities, formatValue, type Entity, type Row } from '../lib/fields'
import { EXPIRY_WARNING_DAYS, daysUntil, formatDate, isoDateFromToday } from '../lib/format'
import { describeError } from '../lib/records'
import { supabase } from '../lib/supabase'

const MAX_ALERT_ROWS = 1000

interface Alert {
  id: string
  name: string
  search: string
  what: string
  date: string
}

interface Summary {
  entity: Entity
  active: number
  passive: number
  alerts: Alert[]
}

async function loadSummary(entity: Entity): Promise<Summary> {
  const limit = isoDateFromToday(EXPIRY_WARNING_DAYS)
  const dated = entity.fields.filter((field) => field.expiry)
  const count = (status: string) =>
    supabase.from(entity.table).select('id', { count: 'exact', head: true }).eq('status', status)

  const [active, passive, due] = await Promise.all([
    count('Aktif'),
    count('Pasif'),
    supabase
      .from(entity.table)
      .select('*')
      .eq('status', 'Aktif')
      .or(dated.map((field) => `${field.key}.lte.${limit}`).join(','))
      .limit(MAX_ALERT_ROWS),
  ])
  const error = active.error ?? passive.error ?? due.error
  if (error) throw new Error(describeError(error))

  const alerts = (due.data as Row[]).flatMap((row) =>
    dated
      .filter((field) => row[field.key] && String(row[field.key]) <= limit)
      .map((field) => ({
        id: `${row.id}-${field.key}`,
        name: formatValue(entity.fields[0], row[entity.keyField]),
        search: String(row[entity.keyField]),
        what: field.label,
        date: String(row[field.key]),
      })),
  )
  alerts.sort((a, b) => a.date.localeCompare(b.date))
  return { entity, active: active.count ?? 0, passive: passive.count ?? 0, alerts }
}

function DueBadge({ date }: { date: string }) {
  const days = daysUntil(date)
  if (days < 0) return <span className="badge badge-danger">{-days} gün geçti</span>
  return <span className="badge badge-warning">{days === 0 ? 'Bugün' : `${days} gün kaldı`}</span>
}

export function Dashboard() {
  const [summaries, setSummaries] = useState<Summary[] | null>(null)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    Promise.all(entities.map(loadSummary))
      .then(setSummaries)
      .catch((error: Error) => setFailure(error.message))
  }, [])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Özet</h1>
          <p className="muted">Filo ve hatların güncel durumu</p>
        </div>
      </header>

      {failure && <p className="alert alert-error">{failure}</p>}
      {!summaries && !failure && <p className="empty">Yükleniyor…</p>}

      {summaries && (
        <>
          <div className="stats">
            {summaries.map(({ entity, active, passive }) => (
              <Link key={entity.table} to={entity.path} className="stat">
                <span className="stat-label">{entity.title}</span>
                <span className="stat-value">{(active + passive).toLocaleString('tr-TR')}</span>
                <span className="muted">
                  {active.toLocaleString('tr-TR')} aktif · {passive.toLocaleString('tr-TR')} pasif
                </span>
              </Link>
            ))}
            <div className="stat">
              <span className="stat-label">Süresi Geçenler</span>
              <span className="stat-value text-danger">
                {summaries.flatMap((summary) => summary.alerts).filter((alert) => daysUntil(alert.date) < 0).length}
              </span>
              <span className="muted">Aktif kayıtlarda</span>
            </div>
            <div className="stat">
              <span className="stat-label">{EXPIRY_WARNING_DAYS} Gün İçinde Bitecek</span>
              <span className="stat-value text-warning">
                {summaries.flatMap((summary) => summary.alerts).filter((alert) => daysUntil(alert.date) >= 0).length}
              </span>
              <span className="muted">Aktif kayıtlarda</span>
            </div>
          </div>

          {summaries.map(({ entity, alerts }) => (
            <section key={entity.table} className="table-card">
              <h2>{entity.title} — yaklaşan ve geçmiş tarihler</h2>
              {alerts.length === 0 ? (
                <p className="empty">Önümüzdeki {EXPIRY_WARNING_DAYS} gün içinde süresi dolan kayıt yok.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{entity.fields[0].label}</th>
                        <th>Konu</th>
                        <th>Tarih</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((alert) => (
                        <tr key={alert.id}>
                          <td>
                            <Link to={`${entity.path}?q=${encodeURIComponent(alert.search)}`}>{alert.name}</Link>
                          </td>
                          <td>{alert.what}</td>
                          <td>{formatDate(alert.date)}</td>
                          <td>
                            <DueBadge date={alert.date} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </>
  )
}
