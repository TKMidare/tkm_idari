import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  // Sihirli bağlantı / OAuth kullanılmadığı için adres çubuğundan oturum okunmaz.
  { auth: { detectSessionInUrl: false } },
)
