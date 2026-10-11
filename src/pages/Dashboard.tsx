import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PASSIVE, entities, formatValue, type Entity, type Field, type Row } from '../lib/fields'
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
  counts: { status: string; count: number }[]
  /** Bitiş tarihi alanı olmayan kayıt türlerinde null. */
  alerts: Alert[] | null
}

async function loadAlerts(entity: Entity, dated: Field[]): Promise<Alert[]> {
  const limit = isoDateFromToday(EXPIRY_WARNING_DAYS)
  const { data, error } = await supabase
    .from(entity.table)
    .select('*')
    .neq('status', PASSIVE)
    .or(dated.map((field) => `${field.key}.lte.${limit}`).join(','))
    .limit(MAX_ALERT_ROWS)
  if (error) throw new Error(describeError(error))

  const alerts = (data as Row[]).flatMap((row) =>
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
  return alerts.sort((a, b) => a.date.localeCompare(b.date))
}

async function loadSummary(entity: Entity): Promise<Summary> {
  const statuses = entity.fields.find((field) => field.key === 'status')!.options!
  const dated = entity.fields.filter((field) => field.expiry)

  const [counts, alerts] = await Promise.all([
    Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await supabase
          .from(entity.table)
          .select('id', { count: 'exact', head: true })
          .eq('status', status)
        if (error) throw new Error(describeError(error))
        return { status, count: count ?? 0 }
      }),
    ),
    dated.length > 0 ? loadAlerts(entity, dated) : null,
  ])
  return { entity, counts, alerts }
}

function DueBadge({ date }: { date: string }) {
  const days = daysUntil(date)
  if (days < 0) return <span className="badge badge-danger">{-days} gün geçti</span>
  return <span className="badge badge-warning">{days === 0 ? 'Bugün' : `${days} gün kaldı`}</span>
}

export function Dashboard() {
  const [summaries, setSummaries] = useState<Summary[] | null>(null)
  const [failure, setFailure] = useState('')
  const allAlerts = summaries?.flatMap((summary) => summary.alerts ?? []) ?? []

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
          <p className="muted">Araç, hat ve jeneratörlerin güncel durumu</p>
        </div>
      </header>

      {failure && <p className="alert alert-error">{failure}</p>}
      {!summaries && !failure && <p className="empty">Yükleniyor…</p>}

      {summaries && (
        <>
          <div className="stats">
            {summaries.map(({ entity, counts }) => (
              <Link key={entity.table} to={entity.path} className="stat">
                <span className="stat-label">{entity.title}</span>
                <span className="stat-value">
                  {counts.reduce((total, { count }) => total + count, 0).toLocaleString('tr-TR')}
                </span>
                <span className="muted">
                  {counts.map(({ status, count }) => `${count.toLocaleString('tr-TR')} ${status.toLocaleLowerCase('tr')}`).join(' · ')}
                </span>
              </Link>
            ))}
            <div className="stat">
              <span className="stat-label">Süresi Geçenler</span>
              <span className="stat-value text-danger">
                {allAlerts.filter((alert) => daysUntil(alert.date) < 0).length}
              </span>
              <span className="muted">Pasif olmayan kayıtlarda</span>
            </div>
            <div className="stat">
              <span className="stat-label">{EXPIRY_WARNING_DAYS} Gün İçinde Bitecek</span>
              <span className="stat-value text-warning">
                {allAlerts.filter((alert) => daysUntil(alert.date) >= 0).length}
              </span>
              <span className="muted">Pasif olmayan kayıtlarda</span>
            </div>
          </div>

          {summaries.map(({ entity, alerts }) => alerts && (
            <section key={entity.table} className="table-card">
              <h2>{entity.title} — yaklaşan ve geçmiş tarihler</h2>
              {alerts.length === 0 ? (
                <p className="empty">Önümüzdeki {EXPIRY_WARNING_DAYS} gün içinde süresi dolan kayıt yok.</p>
              ) : (
                <div className="table-scroll">
                  <table className="cards cards-compact">
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
                          <td className="cell-summary">{alert.what}</td>
                          <td className="cell-summary">{formatDate(alert.date)}</td>
                          <td className="cell-status">
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
