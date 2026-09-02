import { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function ConfirmationPopup({ gestureName, onConfirm, onDismiss }) {
  useEffect(() => {
    const timeoutId = setTimeout(onDismiss, 10000)
    return () => clearTimeout(timeoutId)
  }, [onDismiss])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') onConfirm()
      if (event.key === 'Escape') onDismiss()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm, onDismiss])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="panel relative z-10 mx-4 max-w-sm p-6 text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gesture-confirmation-title"
      >
        <span aria-hidden="true" className="mb-4 block text-5xl">
          🤟
        </span>
        <p className="micro mb-2">Gesture Detected</p>
        <p
          id="gesture-confirmation-title"
          className="font-display mb-1 text-xl font-semibold text-white"
        >
          Add &lsquo;{gestureName}&rsquo;
        </p>
        <p className="mb-6 text-sm text-white/50">to your sentence?</p>
        <div className="flex justify-center gap-3">
          <button type="button" className="btn-signal px-6 py-2" onClick={onConfirm}>
            Yes
          </button>
          <button type="button" className="btn-ghost px-6 py-2" onClick={onDismiss}>
            No
          </button>
        </div>
      </motion.div>
    </div>
  )
}
