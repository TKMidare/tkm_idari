import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth'
import { Layout } from './components/Layout'
import { RecordsPage } from './components/RecordsPage'
import { entities } from './lib/fields'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Login } from './pages/Login'

function Protected() {
  const { session, loading } = useAuth()
  if (loading) return null
  return session ? <Layout /> : <Navigate to="/giris" replace />
}

export function App() {
  // GitHub Pages sunucu tarafı yönlendirme sunmadığı için adresler # ile tutulur.
  return (
    <HashRouter>
      <Routes>
        <Route path="/giris" element={<Login />} />
        <Route element={<Protected />}>
          <Route index element={<Dashboard />} />
          {entities.map((entity) => (
            <Route key={entity.table} path={entity.path} element={<RecordsPage key={entity.table} entity={entity} />} />
          ))}
          <Route path="/gecmis" element={<History />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
