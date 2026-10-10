import { useState, type FormEvent } from 'react'
import { NavLink, Outlet } from 'react-router'
import { signOut, useAuth } from '../auth'
import { entities } from '../lib/fields'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

const MIN_PASSWORD_LENGTH = 10

const links = [
  { to: '/', label: 'Özet' },
  ...entities.map((entity) => ({ to: entity.path, label: entity.title })),
  { to: '/gecmis', label: 'Değişiklik Geçmişi' },
]

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setMessage(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)
    if (password !== repeat) return setMessage('Şifreler birbiriyle aynı değil.')

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (!error) return setDone(true)
    setMessage(
      error.code === 'same_password'
        ? 'Yeni şifre eskisiyle aynı olamaz.'
        : error.code === 'weak_password'
          ? 'Şifre yeterince güçlü değil. Harf, rakam ve sembol içeren daha uzun bir şifre seçin.'
          : 'Şifre değiştirilemedi. Çıkış yapıp yeniden giriş yaptıktan sonra tekrar deneyin.',
    )
  }

  return (
    <Modal title="Şifre Değiştir" onClose={onClose}>
      {done ? (
        <>
          <div className="modal-body">
            <p className="alert alert-success">Şifreniz değiştirildi.</p>
          </div>
          <footer className="modal-footer">
            <button type="button" className="button button-primary" onClick={onClose}>
              Tamam
            </button>
          </footer>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="new-password">Yeni şifre</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="repeat-password">Yeni şifre (tekrar)</label>
              <input id="repeat-password" type="password" autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} />
            </div>
            {message && <p className="alert alert-error">{message}</p>}
          </div>
          <footer className="modal-footer">
            <button type="button" className="button" onClick={onClose}>
              Vazgeç
            </button>
            <button type="submit" className="button button-primary" disabled={saving}>
              Kaydet
            </button>
          </footer>
        </form>
      )}
    </Modal>
  )
}

export function Layout() {
  const { session } = useAuth()
  const [changingPassword, setChangingPassword] = useState(false)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="28" height="28" />
          <span>TKM İdari İşler</span>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <span className="account-email" title={session?.user.email}>
            {session?.user.email}
          </span>
          <button type="button" onClick={() => setChangingPassword(true)}>
            Şifre Değiştir
          </button>
          <button type="button" onClick={() => void signOut()}>
            Çıkış Yap
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      {changingPassword && <PasswordDialog onClose={() => setChangingPassword(false)} />}
    </div>
  )
}
