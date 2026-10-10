import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AuthProvider } from './auth'
import './styles.css'

// Başka bir sitenin içine gömülü (iframe) açıldıysa çalışmaz: tıklama tuzağına
// karşı koruma. GitHub Pages'te bunu sağlayan HTTP başlığı ayarlanamıyor.
if (window.top === window.self) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  )
}
