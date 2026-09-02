import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import api, { getErrorMessage } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { HAND_CONNECTIONS, parseLandmarks } from '../utils/handTracking'

/** Renders a stored gesture as a small normalised hand skeleton. */
function GestureGlyph({ landmarks }) {
  const points = useMemo(() => {
    if (landmarks.length < 2) return []
    const xs = landmarks.map((point) => point.x)
    const ys = landmarks.map((point) => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const span = Math.max(maxX - minX, maxY - minY) || 1
    const padding = 14
    const size = 100 - padding * 2
    return landmarks.map((point) => ({
      x: padding + ((point.x - minX) / span) * size,
      y: padding + ((point.y - minY) / span) * size
    }))
  }, [landmarks])

  if (points.length < 21) {
    return (
      <div className="grid h-full w-full place-items-center">
        <span className="micro">No preview</span>
      </div>
    )
  }

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" fill="none">
      {HAND_CONNECTIONS.map(([from, to]) => {
        const a = points[from]
        const b = points[to]
        if (!a || !b) return null
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )
      })}
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={[4, 8, 12, 16, 20].includes(index) ? 2.6 : 1.5}
          fill={[4, 8, 12, 16, 20].includes(index) ? '#c6ff3d' : 'currentColor'}
        />
      ))}
    </svg>
  )
}

/** Formats whatever timestamp shape the API returns. */
function formatDate(gesture) {
  const raw = gesture.created_at || gesture.createdAt || gesture.created || null
  if (!raw) return 'Date unknown'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export default function DictionaryTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const mountedRef = useRef(true)

  const [gestures, setGestures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [query, setQuery] = useState('')

  const loadGestures = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/gestures')
      if (!mountedRef.current) return
      setGestures(Array.isArray(data.gestures) ? data.gestures : [])
    } catch (err) {
      if (!mountedRef.current) return
      setError(getErrorMessage(err, 'Could not load the gesture dictionary.'))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadGestures()
    return () => {
      mountedRef.current = false
    }
  }, [loadGestures])

  const handleDelete = async (gesture) => {
    setActionError('')
    setDeletingId(gesture.id)
    try {
      await api.delete(`/api/gestures/${gesture.id}`)
      if (!mountedRef.current) return
      setGestures((prev) => prev.filter((item) => item.id !== gesture.id))
    } catch (err) {
      if (!mountedRef.current) return
      setActionError(getErrorMessage(err, 'Could not delete that gesture.'))
    } finally {
      if (mountedRef.current) setDeletingId(null)
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const decorated = gestures.map((gesture) => ({
      ...gesture,
      landmarks: parseLandmarks(gesture.landmarks_json)
    }))
    if (!needle) return decorated
    return decorated.filter((gesture) => gesture.name?.toLowerCase().includes(needle))
  }, [gestures, query])

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-4xl leading-none font-semibold text-white tabular-nums">
            {String(gestures.length).padStart(2, '0')}
          </span>
          <div>
            <p className="text-sm text-white/70">
              gesture{gestures.length === 1 ? '' : 's'} in the shared dictionary
            </p>
            <p className="micro mt-1">{isAdmin ? 'Admin · editable' : 'User · read-only'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search gestures"
            className="field sm:w-64"
          />
          <button
            type="button"
            onClick={loadGestures}
            disabled={loading}
            className="btn-ghost shrink-0 rounded-xl px-4 py-3 text-sm"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {actionError && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-5 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200"
          >
            {actionError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-2xl border border-white/6 bg-white/3"
              style={{ animationDelay: `${index * 90}ms` }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-10 rounded-2xl border border-red-500/25 bg-red-500/8 px-6 py-8 text-center">
          <p className="text-sm text-red-200">{error}</p>
          <button type="button" onClick={loadGestures} className="btn-ghost mt-5 rounded-xl px-5 py-2 text-sm">
            Try again
          </button>
        </div>
      ) : gestures.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="panel mt-10 rounded-[1.75rem] px-8 py-16 text-center"
        >
          <span aria-hidden="true" className="block text-4xl">
            🤟
          </span>
          <h3 className="font-display mt-5 text-2xl font-semibold tracking-[-0.02em] text-white">
            No gestures in dictionary yet
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/45">
            {isAdmin
              ? 'Head to the Train tab and record your first three-second gesture.'
              : 'An administrator needs to train the first gesture before it shows up here.'}
          </p>
        </motion.div>
      ) : visible.length === 0 ? (
        <p className="mt-12 text-center text-sm text-white/40">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((gesture, index) => (
              <motion.article
                key={gesture.id}
                layout
                initial={{ opacity: 0, y: 26, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{
                  delay: Math.min(index * 0.06, 0.5),
                  duration: 0.6,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="panel panel-hover group relative overflow-hidden rounded-2xl p-5"
              >
                {/* Index marker */}
                <span className="micro absolute top-5 right-5">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="h-24 w-24 text-violet-300/70 transition-colors duration-500 group-hover:text-violet-200">
                  <GestureGlyph landmarks={gesture.landmarks} />
                </div>

                <h3 className="font-display mt-4 text-2xl leading-tight font-semibold tracking-[-0.02em] break-words text-white">
                  {gesture.name}
                </h3>

                <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="micro">Created</dt>
                    <dd className="font-mono text-xs text-white/60">{formatDate(gesture)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="micro">Landmarks</dt>
                    <dd className="font-mono text-xs text-white/60 tabular-nums">
                      {gesture.landmarks.length}
                    </dd>
                  </div>
                </dl>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(gesture)}
                    disabled={deletingId === gesture.id}
                    className="btn-danger mt-5 w-full rounded-lg py-2.5 text-xs font-medium tracking-[0.08em] uppercase"
                  >
                    {deletingId === gesture.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}

                {/* Corner accent */}
                <span className="pointer-events-none absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl transition-all duration-500 group-hover:bg-[#c6ff3d]/12" />
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
