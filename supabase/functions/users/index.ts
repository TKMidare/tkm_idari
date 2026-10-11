// Kullanıcı yönetimi — yalnızca yöneticiler çağırabilir.
//
// Hesap açma, silme ve yetki verme tam yetkili (service role) anahtar gerektirir.
// Bu anahtar yalnızca burada, Supabase sunucusunda bulunur; siteye hiç gönderilmez.
// Supabase Dashboard > Edge Functions üzerinden "users" adıyla yayınlanır.

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = ['admin', 'user']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const fail = (status: number, error: string) => reply(status, { error })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return fail(405, 'invalid')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Çağıranın kimliği ve yetkisi her istekte veritabanından taze okunur;
  // yetkisi alınmış birinin elindeki eski oturum bilgisi işe yaramaz.
  const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '') ?? ''
  const { data: session } = await admin.auth.getUser(token)
  const caller = session.user
  if (!caller) return fail(401, 'unauthenticated')
  if (caller.app_metadata?.role !== 'admin') return fail(403, 'forbidden')

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(400, 'invalid')

  const log = (action: string, id: string, before: unknown, after: unknown) =>
    admin.from('audit_log').insert({
      table_name: 'users',
      record_id: id,
      action,
      old_data: before,
      new_data: after,
      user_id: caller.id,
      user_email: caller.email,
    })

  if (body.action === 'list') {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return fail(500, 'failed')
    return reply(
      200,
      data.users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.app_metadata?.role === 'admin' ? 'admin' : 'user',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      })),
    )
  }

  if (body.action === 'create') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!EMAIL.test(email) || email.length > 254 || !ROLES.includes(body.role)) return fail(400, 'invalid')
    if (password.length < 10 || password.length > 72) return fail(400, 'weak_password')

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: body.role },
    })
    if (error) {
      if (error.code === 'email_exists') return fail(409, 'email_exists')
      if (error.code === 'weak_password') return fail(400, 'weak_password')
      return fail(500, 'failed')
    }
    await log('INSERT', data.user.id, null, { email, role: body.role })
    return reply(200, { id: data.user.id })
  }

  // Bundan sonraki işlemler başka bir kullanıcıyı hedefler. Yönetici kendi hesabını
  // silemez ve kendi yetkisini kaldıramaz; böylece sistem yöneticisiz kalmaz.
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return fail(400, 'invalid')
  if (body.id === caller.id) return fail(400, 'self')

  const { data: found } = await admin.auth.admin.getUserById(body.id)
  const target = found.user
  if (!target) return fail(404, 'not_found')
  const before = { email: target.email, role: target.app_metadata?.role === 'admin' ? 'admin' : 'user' }

  if (body.action === 'delete') {
    const { error } = await admin.auth.admin.deleteUser(target.id)
    if (error) return fail(500, 'failed')
    await log('DELETE', target.id, before, null)
    return reply(200, { id: target.id })
  }

  if (body.action === 'set_role') {
    if (!ROLES.includes(body.role)) return fail(400, 'invalid')
    const { error } = await admin.auth.admin.updateUserById(target.id, { app_metadata: { role: body.role } })
    if (error) return fail(500, 'failed')
    await log('UPDATE', target.id, before, { ...before, role: body.role })
    return reply(200, { id: target.id })
  }

  return fail(400, 'invalid')
})
