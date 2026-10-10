import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Yayın derlemesine Content-Security-Policy ekler: yalnızca sitenin kendi
// dosyaları çalışır, veri yalnızca Supabase projesine gider.
function contentSecurityPolicy(supabaseUrl: string): Plugin {
  const api = new URL(supabaseUrl).origin
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    `connect-src ${api}`,
    // Büyük Excel dosyaları tarayıcıda arka plan iş parçacığında sıkıştırılır.
    'worker-src blob:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('.env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlanmalı (.env.example dosyasına bakın).')
  }

  return {
    // Göreli yollar: site GitHub Pages'te /depo-adi/ altında da çalışır.
    base: './',
    plugins: [react(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    build: { sourcemap: false },
  }
})
