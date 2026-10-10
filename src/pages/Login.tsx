import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { markActivity, useAuth } from '../auth'
import { supabase } from '../lib/supabase'

export function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    markActivity()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (!error) return

    setLoading(false)
    setPassword('')
    // Hangi bilginin yanlış olduğu bilerek söylenmez.
    setMessage(
      error.status === 429
        ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.'
        : error.status === 400
          ? 'E-posta veya şifre hatalı.'
          : 'Giriş yapılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
    )
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="44" height="44" />
        <h1>TKM İdari İşler</h1>
        <p className="muted">Devam etmek için giriş yapın.</p>

        <div className="form-field">
          <label htmlFor="email">E-posta</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="password">Şifre</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {message && <p className="alert alert-error">{message}</p>}
        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
        <p className="muted login-note">Hesabınız yoksa yöneticinize başvurun.</p>
      </form>
    </div>
  )
}
