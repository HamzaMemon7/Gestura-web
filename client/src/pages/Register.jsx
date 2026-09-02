import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
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

    const name = form.name.trim()
    const email = form.email.trim()

    if (!name || !email || !form.password) {
      setError('All three fields are required.')
      return
    }
    if (form.password.length < 6) {
      setError('Use at least 6 characters for your password.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await register(name, email, form.password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const strength = Math.min(3, Math.floor(form.password.length / 4))

  return (
    <AuthShell
      eyebrow="Session · New account"
      sub="Sign Language Detection Platform"
      headline="Join the platform to browse the gesture dictionary, run live detection and hear recognised signs spoken aloud."
    >
      <form onSubmit={handleSubmit} noValidate className="relative">
        <header className="mb-8">
          <p className="micro">Step 01 / Create profile</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.02em] text-white">
            Create account
          </h2>
        </header>

        <div className="space-y-5">
          <label className="block">
            <span className="micro mb-2 block">Name</span>
            <input
              type="text"
              className="field"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={form.name}
              onChange={update('name')}
              disabled={submitting}
            />
          </label>

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
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={update('password')}
              disabled={submitting}
            />
            <span className="mt-2.5 flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${
                    index < strength
                      ? 'bg-gradient-to-r from-violet-500 to-blue-500'
                      : 'bg-white/8'
                  }`}
                />
              ))}
            </span>
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
            {submitting ? 'Creating account…' : 'Create Account'}
            {!submitting && <span aria-hidden="true">→</span>}
          </span>
        </button>

        <p className="mt-7 border-t border-white/8 pt-6 text-center text-sm text-white/45">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-medium text-white underline decoration-violet-500/60 decoration-2 underline-offset-4 transition-colors hover:decoration-[#c6ff3d]"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
