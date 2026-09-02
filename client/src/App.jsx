import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'

/** Full-screen boot state shown while the stored session is validated. */
function SessionLoader() {
  return (
    <div className="relative z-10 grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-400 border-r-blue-400" />
        </div>
        <p className="micro">Restoring session</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, restoring } = useAuth()
  if (restoring) return <SessionLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function GuestRoute({ children }) {
  const { isAuthenticated, restoring } = useAuth()
  if (restoring) return <SessionLoader />
  if (isAuthenticated) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  const { isAuthenticated, restoring } = useAuth()

  return (
    <>
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <Routes>
        <Route
          path="/"
          element={
            restoring ? (
              <SessionLoader />
            ) : (
              <Navigate to={isAuthenticated ? '/app' : '/login'} replace />
            )
          }
        />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
