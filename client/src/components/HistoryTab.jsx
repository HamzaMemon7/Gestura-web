import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { jsPDF } from 'jspdf'
import api, { getErrorMessage } from '../utils/api'

export default function HistoryTab() {
  const mountedRef = useRef(true)
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSentences = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/sentences')
      if (!mountedRef.current) return
      setSentences(data.sentences || [])
    } catch (err) {
      if (!mountedRef.current) return
      setError(getErrorMessage(err, 'Could not load sentence history.'))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadSentences()
    return () => { mountedRef.current = false }
  }, [loadSentences])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/sentences/${id}`)
      setSentences(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete sentence.'))
    }
  }

  const handleExportPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('GesturaWeb — Sentence History', 14, 22)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`Exported on ${new Date().toLocaleString()}`, 14, 30)
    doc.setTextColor(0)
    doc.setFontSize(12)

    let y = 44
    sentences.forEach((s, i) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      const date = s.created_at ? new Date(s.created_at).toLocaleString() : ''
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(`${i + 1}. ${date}`, 14, y)
      y += 6
      doc.setFontSize(12)
      doc.setTextColor(0)
      // Wrap long text
      const lines = doc.splitTextToSize(s.text, 180)
      doc.text(lines, 14, y)
      y += lines.length * 7 + 6
    })

    doc.save('gestura-history.pdf')
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header with Export */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Saved Sentences
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {sentences.length} sentence{sentences.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          type="button"
          className="btn-signal rounded-xl px-5 py-3 text-sm"
          onClick={handleExportPdf}
          disabled={sentences.length === 0}
        >
          <span className="relative z-10">📄 Export PDF</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {error}
          <button type="button" onClick={loadSentences} className="ml-3 underline decoration-red-400/60 underline-offset-4">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-white/6 bg-white/3" />
          ))}
        </div>
      ) : sentences.length === 0 ? (
        <div className="py-20 text-center">
          <span className="mb-4 block text-4xl">📝</span>
          <p className="text-white/45">No sentences saved yet.</p>
          <p className="mt-1 text-sm text-white/30">Use the Builder tab to create and save sentences.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sentences.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="panel flex items-start justify-between gap-4 rounded-[1.35rem] p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed text-white">{s.text}</p>
                  <p className="micro mt-2">
                    {s.created_at ? new Date(s.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="btn-danger shrink-0 rounded-lg px-3 py-1.5 text-xs"
                >
                  Delete
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
