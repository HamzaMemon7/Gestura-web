import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  // `restoring` is true until the stored session has been validated on mount.
  const [restoring, setRestoring] = useState(Boolean(localStorage.getItem('token')))

  // Restore an existing session from localStorage.
  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (!stored) {
      setRestoring(false)
      return
    }

    let active = true
    api
      .get('/api/auth/me')
      .then(({ data }) => {
        if (!active) return
        setUser(data.user)
        setToken(stored)
      })
      .catch(() => {
        if (!active) return
        localStorage.removeItem('token')
        setToken('')
        setUser(null)
      })
      .finally(() => {
        if (active) setRestoring(false)
      })

    return () => {
      active = false
    }
  }, [])

  const persistSession = useCallback((data) => {
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const login = useCallback(
    async (email, password) => {
      try {
        const { data } = await api.post('/api/auth/login', { email, password })
        return persistSession(data)
      } catch (error) {
        throw new Error(getErrorMessage(error, 'Invalid email or password.'))
      }
    },
    [persistSession]
  )

  const register = useCallback(
    async (name, email, password) => {
      try {
        const { data } = await api.post('/api/auth/register', { name, email, password })
        return persistSession(data)
      } catch (error) {
        throw new Error(getErrorMessage(error, 'Could not create your account.'))
      }
    },
    [persistSession]
  )

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken('')
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      token,
      restoring,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout
    }),
    [user, token, restoring, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return context
}

export default AuthContext
