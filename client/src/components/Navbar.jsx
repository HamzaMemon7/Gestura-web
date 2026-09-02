import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_STYLES = {
  ADMIN: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
  USER: 'border-blue-400/40 bg-blue-500/15 text-blue-200'
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const role = user?.role === 'ADMIN' ? 'ADMIN' : 'USER'
  // Fall back to the email's local part, then to a neutral label.
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'Guest'

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#0b0b12]/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8">
        {/* Wordmark */}
        <Link to="/app" className="group flex shrink-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-600/25 to-blue-600/25 text-lg transition-transform duration-500 group-hover:-rotate-12"
          >
            🤟
          </span>
          <span className="font-display text-[1.35rem] leading-none font-semibold tracking-[-0.02em] text-white">
            Gestura<span className="text-signal">Web</span>
          </span>
        </Link>

        {/* Session */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-medium text-white" title={displayName}>
                {displayName}
              </p>
              {user?.email && (
                <p className="hidden truncate font-mono text-[0.625rem] tracking-[0.16em] text-white/35 uppercase sm:block">
                  {user.email}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[0.625rem] tracking-[0.2em] ${ROLE_STYLES[role]}`}
            >
              {role}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="btn-ghost shrink-0 rounded-xl px-4 py-2 text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Signal hairline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
    </motion.header>
  )
}
