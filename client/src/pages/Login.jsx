import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    const email = form.email.trim()
    if (!email || !form.password) {
      setError('Enter your email and password to continue.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await login(email, form.password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Session · Sign in"
      sub="Sign Language Detection Platform"
      headline="Train a vocabulary of hand gestures, then let the browser read them back to you — landmark by landmark."
    >
      <form onSubmit={handleSubmit} noValidate className="relative">
        <header className="mb-8">
          <p className="micro">Step 01 / Authenticate</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.02em] text-white">
            Welcome back
          </h2>
        </header>

        <div className="space-y-5">
          <label className="block">
            <span className="micro mb-2 block">Email</span>
            <input
              type="email"
              className="field"
              autoComplete="email"
              placeholder="you@studio.com"
              value={form.email}
              onChange={update('email')}
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="micro mb-2 flex items-center justify-between">
              <span>Password</span>
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="font-mono text-[0.6875rem] tracking-[0.18em] text-violet-300/70 transition-colors hover:text-[#c6ff3d]"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              className="field"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={update('password')}
              disabled={submitting}
            />
          </label>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <p
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200"
              >
                <span aria-hidden="true" className="mt-px font-mono text-red-400">
                  !
                </span>
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={submitting} className="btn-signal mt-8 w-full rounded-xl py-3.5">
          <span className="relative z-10 flex items-center justify-center gap-2.5">
            {submitting ? 'Signing in…' : 'Sign In'}
            {!submitting && <span aria-hidden="true">→</span>}
          </span>
        </button>

        <p className="mt-7 border-t border-white/8 pt-6 text-center text-sm text-white/45">
          No account yet?{' '}
          <Link
            to="/register"
            className="font-medium text-white underline decoration-violet-500/60 decoration-2 underline-offset-4 transition-colors hover:decoration-[#c6ff3d]"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
