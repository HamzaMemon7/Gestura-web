import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import TrainTab from '../components/TrainTab'
import DetectTab from '../components/DetectTab'
import DictionaryTab from '../components/DictionaryTab'
import AdminStatsTab from '../components/AdminStatsTab'
import BuilderTab from '../components/BuilderTab'
import HistoryTab from '../components/HistoryTab'

const TABS = {
  stats:      { id: 'stats',      label: 'Stats',      index: '00', blurb: 'Platform overview and usage metrics' },
  builder:    { id: 'builder',    label: 'Builder',    index: '04', blurb: 'Build sentences from recognised gestures' },
  history: { id: 'history', label: 'History', index: '05', blurb: 'View and export your saved sentences' },
  train: { id: 'train', label: 'Train', index: '01', blurb: 'Capture new gestures from the webcam' },
  detect: { id: 'detect', label: 'Detect', index: '02', blurb: 'Recognise signs live and speak them' },
  dictionary: { id: 'dictionary', label: 'Dictionary', index: '03', blurb: 'Every gesture stored on the server' }
}

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const tabs = useMemo(
    () => (isAdmin
      ? [TABS.stats, TABS.train, TABS.detect, TABS.dictionary, TABS.builder, TABS.history]
      : [TABS.detect, TABS.dictionary, TABS.builder, TABS.history]),
    [isAdmin]
  )

  const [active, setActive] = useState(tabs[0].id)
  const activeTab = tabs.find((tab) => tab.id === active) || tabs[0]

  return (
    <div className="relative z-10 min-h-dvh">
      <Navbar />

      <main className="mx-auto max-w-[1400px] px-5 pt-24 pb-20 sm:px-8">
        {/* ── Section header ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-8 border-b border-white/8 pb-1 lg:flex-row lg:items-end lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="micro">
              Workspace · {isAdmin ? 'Full access' : 'Read & detect'}
            </p>
            <h1 className="font-display mt-3 text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[0.92] font-semibold tracking-[-0.03em] text-white">
              {activeTab.label}
              <span className="text-signal">.</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/45">{activeTab.blurb}</p>
          </motion.div>

          {/* ── Tab bar ───────────────────────────────────────────────── */}
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Sections">
            {tabs.map((tab, i) => {
              const isActive = tab.id === active
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="relative shrink-0 px-5 pt-3 pb-4 text-left"
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span
                    className={`font-mono text-[0.625rem] tracking-[0.22em] transition-colors ${
                      isActive ? 'text-[#c6ff3d]' : 'text-white/25'
                    }`}
                  >
                    {tab.index}
                  </span>
                  <span
                    className={`font-display mt-1 block text-lg font-medium tracking-[-0.01em] transition-colors ${
                      isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
                    }`}
                  >
                    {tab.label}
                  </span>

                  {isActive && (
                    <motion.span
                      layoutId="tab-underline"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500"
                    />
                  )}
                </motion.button>
              )
            })}
          </nav>
        </div>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.section
            key={active}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="pt-12"
          >
            {active === 'train' && <TrainTab />}
            {active === 'detect' && <DetectTab />}
            {active === 'dictionary' && <DictionaryTab />}
            {active === 'stats' && <AdminStatsTab />}
            {active === 'builder' && <BuilderTab />}
            {active === 'history' && <HistoryTab />}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  )
}
