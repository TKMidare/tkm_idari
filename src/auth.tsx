import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

const IDLE_LIMIT_MS = 30 * 60 * 1000
const ACTIVITY_KEY = 'tkm:last-activity'

interface AuthState {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export const useAuth = () => useContext(AuthContext)

export function markActivity() {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
}

// Yalnızca bu cihazdaki oturumu kapatır.
export const signOut = () => supabase.auth.signOut({ scope: 'local' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })
  const signedIn = state.session !== null

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // 30 dakika işlem yapılmazsa (sekme kapalıyken geçen süre dahil) oturum kapanır.
  useEffect(() => {
    if (!signedIn) return

    const signOutIfIdle = () => {
      const idleFor = Date.now() - Number(localStorage.getItem(ACTIVITY_KEY))
      if (idleFor > IDLE_LIMIT_MS) void signOut()
    }
    let lastWrite = 0
    const onActivity = () => {
      if (Date.now() - lastWrite > 5000) {
        lastWrite = Date.now()
        markActivity()
      }
    }

    signOutIfIdle()
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((name) => window.addEventListener(name, onActivity, { capture: true, passive: true }))
    const timer = window.setInterval(signOutIfIdle, 30_000)
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }))
      window.clearInterval(timer)
    }
  }, [signedIn])

  return <AuthContext value={state}>{children}</AuthContext>
}
