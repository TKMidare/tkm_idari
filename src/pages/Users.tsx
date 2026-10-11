import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth, useIsAdmin } from '../auth'
import { Modal } from '../components/Modal'
import { formatDateTime } from '../lib/format'
import {
  MIN_PASSWORD_LENGTH,
  ROLE_LABELS,
  createUser,
  deleteUser,
  listUsers,
  setUserRole,
  type AppUser,
  type Role,
} from '../lib/users'

type Dialog = { kind: 'create' } | { kind: 'delete'; user: AppUser } | null

function CreateDialog({ onCreated, onClose }: { onCreated: (email: string) => void; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) return setMessage('E-posta zorunludur.')
    if (password.length < MIN_PASSWORD_LENGTH) return setMessage(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)

    setSaving(true)
    setMessage('')
    try {
      await createUser(email, password, role)
      onCreated(email.trim())
    } catch (error) {
      setMessage((error as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Yeni Kullanıcı" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="form-field">
            <label htmlFor="user-email">E-posta</label>
            <input id="user-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="user-password">Geçici şifre</label>
            <input id="user-password" type="text" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="muted">Kullanıcıya iletin; ilk girişten sonra "Şifre Değiştir" ile değiştirmesini isteyin.</p>
          </div>
          <div className="form-field">
            <label htmlFor="user-role">Yetki</label>
            <select id="user-role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="user">{ROLE_LABELS.user}</option>
              <option value="admin">{ROLE_LABELS.admin} — kullanıcı ekleyip silebilir</option>
            </select>
          </div>
          {message && <p className="alert alert-error">{message}</p>}
        </div>
        <footer className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Ekleniyor…' : 'Kullanıcı Ekle'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

export function Users() {
  const { session } = useAuth()
  const isAdmin = useIsAdmin()
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let stale = false
    listUsers()
      .then((list) => !stale && setUsers(list.sort((a, b) => a.email.localeCompare(b.email, 'tr'))))
      .catch((error: Error) => !stale && setNotice({ kind: 'error', text: error.message }))
    return () => {
      stale = true
    }
  }, [isAdmin, version])

  if (!isAdmin) return <Navigate to="/" replace />

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      setNotice({ kind: 'success', text: done })
      setVersion((current) => current + 1)
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Kullanıcılar</h1>
          <p className="muted">{users ? `${users.length} kullanıcı` : ' '}</p>
        </div>
        <div className="actions">
          <button type="button" className="button button-primary" onClick={() => setDialog({ kind: 'create' })}>
            + Kullanıcı Ekle
          </button>
        </div>
      </header>

      {notice && (
        <p className={`alert alert-${notice.kind}`} role="status">
          {notice.text}
          <button type="button" className="icon-button" aria-label="Kapat" onClick={() => setNotice(null)}>
            ×
          </button>
        </p>
      )}

      <div className="table-card">
        <div className="table-scroll">
          <table className="cards">
            <thead>
              <tr>
                <th>E-posta</th>
                <th>Yetki</th>
                <th>Oluşturulma</th>
                <th>Son Giriş</th>
                <th className="col-actions">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => {
                const self = user.id === session?.user.id
                const other: Role = user.role === 'admin' ? 'user' : 'admin'
                return (
                  <tr key={user.id}>
                    <td>
                      {user.email}
                      {self && <span className="muted"> (siz)</span>}
                    </td>
                    <td className="cell-status">
                      <span className={user.role === 'admin' ? 'badge badge-ok' : 'badge'}>{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td data-label="Oluşturulma">{formatDateTime(user.created_at)}</td>
                    <td data-label="Son Giriş">{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'}</td>
                    <td className="col-actions">
                      {!self && (
                        <>
                          <button
                            type="button"
                            className="link-button"
                            disabled={busy}
                            onClick={() => run(() => setUserRole(user.id, other), `${user.email} artık ${ROLE_LABELS[other]}.`)}
                          >
                            {other === 'admin' ? 'Yönetici Yap' : 'Yöneticiliği Kaldır'}
                          </button>
                          <button type="button" className="link-button text-danger" onClick={() => setDialog({ kind: 'delete', user })}>
                            Sil
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!users && !notice && <p className="empty">Yükleniyor…</p>}
        </div>
      </div>

      {dialog?.kind === 'create' && (
        <CreateDialog
          onClose={() => setDialog(null)}
          onCreated={(email) => {
            setDialog(null)
            setNotice({ kind: 'success', text: `${email} eklendi.` })
            setVersion((current) => current + 1)
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <Modal title="Kullanıcı Sil" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p>
              <strong>{dialog.user.email}</strong> hesabı kalıcı olarak silinecek ve siteye erişimi hemen kesilecek. Bu
              kişinin eklediği kayıtlar ve değişiklik geçmişi silinmez.
            </p>
          </div>
          <footer className="modal-footer">
            <button type="button" className="button" onClick={() => setDialog(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              className="button button-danger"
              disabled={busy}
              onClick={() => run(() => deleteUser(dialog.user.id), `${dialog.user.email} silindi.`)}
            >
              Sil
            </button>
          </footer>
        </Modal>
      )}
    </>
  )
}
