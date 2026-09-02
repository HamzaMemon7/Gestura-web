import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import api, { getErrorMessage } from '../utils/api'

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.1 }
  }
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  }
}

async function fetchStats(mountedRef, setStats, setLoading, setError) {
  setLoading(true)
  setError(null)

  try {
    const { data } = await api.get('/api/admin/stats')
    if (!mountedRef.current) return
    setStats(data.stats || data)
  } catch (requestError) {
    if (!mountedRef.current) return
    setError(getErrorMessage(requestError, 'Could not load platform statistics.'))
  } finally {
    if (mountedRef.current) setLoading(false)
  }
}

export default function AdminStatsTab() {
  const mountedRef = useRef(true)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadStats = () => fetchStats(mountedRef, setStats, setLoading, setError)

  useEffect(() => {
    mountedRef.current = true
    fetchStats(mountedRef, setStats, setLoading, setError)
    return () => {
      mountedRef.current = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="panel animate-pulse p-6 text-center">
            <div className="mx-auto mb-4 h-9 w-9 rounded-full bg-white/8" />
            <div className="mx-auto mb-3 h-3 w-24 rounded bg-white/8" />
            <div className="mx-auto h-10 w-20 rounded bg-white/8" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-red-200">{error}</p>
        <button type="button" className="btn-ghost mt-5 rounded-xl px-5 py-2 text-sm" onClick={loadStats}>
          Retry
        </button>
      </div>
    )
  }

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: '👥' },
    { label: 'Total Gestures', value: stats?.totalGestures ?? 0, icon: '🤟' },
    { label: 'Total Detections', value: stats?.totalDetections ?? 0, icon: '📊' }
  ]

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="grid gap-4 sm:grid-cols-3"
    >
      {cards.map((card) => (
        <motion.div key={card.label} variants={cardVariants} className="panel p-6 text-center">
          <span aria-hidden="true" className="mb-4 block text-3xl">
            {card.icon}
          </span>
          <p className="micro mb-2">{card.label}</p>
          <p className="font-display text-4xl font-bold text-signal">{card.value}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}
