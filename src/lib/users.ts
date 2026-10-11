import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'admin' | 'user'

export const ROLE_LABELS: Record<Role, string> = { admin: 'Yönetici', user: 'Kullanıcı' }
export const MIN_PASSWORD_LENGTH = 10

export interface AppUser {
  id: string
  email: string
  role: Role
  created_at: string
  last_sign_in_at: string | null
}

const MESSAGES: Record<string, string> = {
  unauthenticated: 'Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.',
  forbidden: 'Bu işlem için yönetici yetkisi gerekir.',
  invalid: 'Girilen bilgiler geçersiz.',
  email_exists: 'Bu e-posta ile kayıtlı bir kullanıcı zaten var.',
  weak_password: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı ve yeterince güçlü olmalıdır.`,
  self: 'Kendi hesabınızı silemez veya kendi yetkinizi kaldıramazsınız.',
  not_found: 'Kullanıcı bulunamadı.',
  not_deployed: 'Kullanıcı yönetimi servisi henüz kurulmamış (Supabase Edge Function: users).',
  failed: 'İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.',
}

/** Kullanıcı işlemleri sunucudaki "users" işlevinde yapılır; yetkiyi o denetler. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('users', { body })
  if (!error) return data as T

  let code = 'failed'
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    const reported = await response.json().catch(() => null)
    code = response.status === 404 && !reported?.error ? 'not_deployed' : (reported?.error ?? 'failed')
  }
  throw new Error(MESSAGES[code] ?? MESSAGES.failed)
}

export const listUsers = () => call<AppUser[]>({ action: 'list' })

export const createUser = (email: string, password: string, role: Role) =>
  call({ action: 'create', email, password, role })

export const deleteUser = (id: string) => call({ action: 'delete', id })

export const setUserRole = (id: string, role: Role) => call({ action: 'set_role', id, role })
