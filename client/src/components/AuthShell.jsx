import { motion } from 'framer-motion'
import { HAND_CONNECTIONS } from '../utils/handTracking'

/** A stylised open hand in normalised MediaPipe coordinates, used as hero art. */
const HERO_HAND = [
  { x: 0.5, y: 0.95 },
  { x: 0.4, y: 0.86 },
  { x: 0.33, y: 0.75 },
  { x: 0.29, y: 0.66 },
  { x: 0.26, y: 0.58 },
  { x: 0.44, y: 0.6 },
  { x: 0.42, y: 0.46 },
  { x: 0.41, y: 0.37 },
  { x: 0.4, y: 0.29 },
  { x: 0.52, y: 0.58 },
  { x: 0.52, y: 0.42 },
  { x: 0.52, y: 0.32 },
  { x: 0.52, y: 0.24 },
  { x: 0.59, y: 0.6 },
  { x: 0.61, y: 0.45 },
  { x: 0.62, y: 0.35 },
  { x: 0.63, y: 0.28 },
  { x: 0.66, y: 0.65 },
  { x: 0.7, y: 0.53 },
  { x: 0.72, y: 0.45 },
  { x: 0.74, y: 0.39 }
]

const SIZE = 520

/** Hand skeleton that draws itself in, then keeps its joints twinkling. */
function HandConstellation() {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-full w-full"
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id="bone" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="60%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      {[0.62, 0.78, 0.94].map((scale, i) => (
        <motion.circle
          key={scale}
          cx={SIZE * 0.5}
          cy={SIZE * 0.62}
          r={SIZE * 0.5 * scale}
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="2 10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.12, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '50% 62%' }}
        />
      ))}

      {HAND_CONNECTIONS.map(([from, to], i) => (
        <motion.line
          key={`${from}-${to}`}
          x1={HERO_HAND[from].x * SIZE}
          y1={HERO_HAND[from].y * SIZE}
          x2={HERO_HAND[to].x * SIZE}
          y2={HERO_HAND[to].y * SIZE}
          stroke="url(#bone)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ delay: 0.35 + i * 0.035, duration: 0.7, ease: 'easeOut' }}
        />
      ))}

      {HERO_HAND.map((point, i) => {
        const tip = [4, 8, 12, 16, 20].includes(i)
        return (
          <motion.circle
            key={i}
            cx={point.x * SIZE}
            cy={point.y * SIZE}
            r={tip ? 5.5 : 3.2}
            fill={tip ? '#c6ff3d' : '#e8e8f0'}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: tip ? [1, 0.45, 1] : 0.85, scale: 1 }}
            transition={{
              opacity: tip
                ? { delay: 1.2, duration: 2.6, repeat: Infinity, repeatType: 'reverse' }
                : { delay: 0.9 + i * 0.03, duration: 0.5 },
              scale: { delay: 0.9 + i * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }
            }}
          />
        )
      })}
    </svg>
  )
}

const MANIFESTO = [
  ['01', 'Record a gesture in three seconds of webcam footage.'],
  ['02', 'Twenty-one landmarks become a portable fingerprint.'],
  ['03', 'Recognition and speech happen on-device, in real time.']
]

/**
 * Asymmetric editorial shell shared by the Login and Register screens:
 * a typographic manifesto on the left, the form panel overlapping it on the right.
 */
export default function AuthShell({ eyebrow, headline, sub, children }) {
  return (
    <main className="relative z-10 min-h-dvh overflow-hidden">
      {/* Grid-breaking vertical wordmark */}
      <div className="pointer-events-none absolute top-0 left-4 hidden h-full items-center lg:flex">
        <span className="vertical-label micro tracking-[0.5em]">
          Gesture&nbsp;→&nbsp;Signal&nbsp;→&nbsp;Speech
        </span>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-6 py-14 lg:grid-cols-12 lg:gap-6 lg:px-16 lg:py-20">
        {/* ── Left: manifesto ─────────────────────────────────────────── */}
        <section className="relative lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <span className="pulse-dot" />
            <p className="micro">{eyebrow}</p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-display mt-6 text-[clamp(2.9rem,7.4vw,5.6rem)] leading-[0.86] font-semibold tracking-[-0.03em] text-white"
          >
            Gestura<span className="text-signal">Web</span>
            <span className="block text-[0.42em] leading-tight font-medium tracking-[-0.01em] text-white/45">
              {sub}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 max-w-md text-[1.02rem] leading-relaxed text-white/55"
          >
            {headline}
          </motion.p>

          <ul className="mt-11 max-w-lg divide-y divide-white/8 border-y border-white/8">
            {MANIFESTO.map(([num, copy], i) => (
              <motion.li
                key={num}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-baseline gap-5 py-4"
              >
                <span className="font-mono text-xs text-violet-400/70 transition-colors group-hover:text-[#c6ff3d]">
                  {num}
                </span>
                <span className="text-sm text-white/60 transition-colors group-hover:text-white/90">
                  {copy}
                </span>
              </motion.li>
            ))}
          </ul>

          {/* Hero art, deliberately bleeding out of the column */}
          <div className="pointer-events-none absolute -top-24 -right-24 hidden h-[560px] w-[560px] opacity-70 xl:block">
            <HandConstellation />
          </div>
        </section>

        {/* ── Right: form panel ───────────────────────────────────────── */}
        <section className="relative lg:col-span-5 lg:pl-8">
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: -1.2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.12, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="panel rounded-[1.75rem] p-7 sm:p-9"
          >
            <div className="absolute -top-5 -left-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-[#0b0b12] text-2xl shadow-[0_18px_40px_-18px_rgba(139,92,246,0.9)]">
              <span aria-hidden="true">🤟</span>
            </div>
            <div className="absolute top-8 right-8 h-px w-16 bg-gradient-to-r from-violet-500 to-transparent" />
            {children}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="micro mt-6 text-center lg:text-right"
          >
            Runs locally · No video leaves your device
          </motion.p>
        </section>
      </div>
    </main>
  )
}
