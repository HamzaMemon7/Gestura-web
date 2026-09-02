import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import api, { getErrorMessage } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import {
  averageFrames,
  createCamera,
  createHands,
  drawHandOverlay,
  parseLandmarks,
  syncCanvasSize,
  teardownTracking,
  toPlainLandmarks
} from '../utils/handTracking'

const RECORD_SECONDS = 3
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Locked-out state for non-admin users. */
function AdminOnlyNotice() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="panel mx-auto max-w-xl overflow-hidden rounded-[1.75rem] p-10 text-center"
    >
      <span aria-hidden="true" className="block text-4xl">
        🔒
      </span>
      <h2 className="font-display mt-5 text-2xl font-semibold tracking-[-0.02em] text-white">
        Only Admin can train gestures
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/50">
        Training writes new entries into the shared dictionary, so it is reserved for
        administrators. You can still run live detection and browse every saved gesture.
      </p>
      <p className="micro mt-8">Access level · User</p>
    </motion.div>
  )
}

export default function TrainTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const handsRef = useRef(null)
  const cameraRef = useRef(null)
  const mountedRef = useRef(true)
  const recordingRef = useRef(false)
  const framesRef = useRef([])
  const latestRef = useRef(null)

  const [cameraState, setCameraState] = useState('booting') // booting | live | error
  const [cameraError, setCameraError] = useState('')
  const [handVisible, setHandVisible] = useState(false)

  const [gestureName, setGestureName] = useState('')
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [samples, setSamples] = useState(0)
  const [saving, setSaving] = useState(false)

  const [gestures, setGestures] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  /** Draws the overlay and, while recording, banks the frame. */
  const handleResults = useCallback((results) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    syncCanvasSize(canvas, results.image)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = results.multiHandLandmarks?.[0]
    if (landmarks?.length) {
      drawHandOverlay(ctx, landmarks)
      latestRef.current = toPlainLandmarks(landmarks)
      if (recordingRef.current) {
        framesRef.current.push(latestRef.current)
        setSamples(framesRef.current.length)
      }
      setHandVisible(true)
    } else {
      latestRef.current = null
      setHandVisible(false)
    }
  }, [])

  // ── Camera + MediaPipe lifecycle ────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return

    let hands
    let camera
    let cancelled = false

    const boot = async () => {
      try {
        hands = createHands()
        handsRef.current = hands
        hands.onResults(handleResults)
        await hands.initialize()
        if (cancelled) return

        const video = videoRef.current
        if (!video) return

        camera = createCamera(video, async () => {
          if (cancelled || !handsRef.current) return
          if (video.readyState < 2) return
          try {
            await handsRef.current.send({ image: video })
          } catch {
            /* frame dropped — keep the stream alive */
          }
        })
        cameraRef.current = camera
        await camera.start()
        if (cancelled) return
        setCameraState('live')
      } catch (error) {
        if (cancelled) return
        setCameraState('error')
        setCameraError(
          error?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the webcam in your browser settings and reload.'
            : getErrorMessage(error, 'Could not start the webcam.')
        )
      }
    }

    boot()

    return () => {
      cancelled = true
      recordingRef.current = false
      teardownTracking(camera, hands)
      handsRef.current = null
      cameraRef.current = null
    }
  }, [isAdmin, handleResults])

  // ── Gesture list ────────────────────────────────────────────────────────
  const loadGestures = useCallback(async () => {
    setLoadingList(true)
    setListError('')
    try {
      const { data } = await api.get('/api/gestures')
      if (!mountedRef.current) return
      setGestures(Array.isArray(data.gestures) ? data.gestures : [])
    } catch (error) {
      if (!mountedRef.current) return
      setListError(getErrorMessage(error, 'Could not load the gesture list.'))
    } finally {
      if (mountedRef.current) setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadGestures()
    return () => {
      mountedRef.current = false
    }
  }, [loadGestures])

  // ── Record + save ───────────────────────────────────────────────────────
  const handleRecord = async () => {
    const name = gestureName.trim()
    setNotice('')
    setFormError('')

    if (!name) {
      setFormError('Give the gesture a name before recording.')
      return
    }
    if (cameraState !== 'live') {
      setFormError('Wait for the camera to go live first.')
      return
    }
    if (gestures.some((gesture) => gesture.name?.toLowerCase() === name.toLowerCase())) {
      setFormError(`"${name}" already exists in the dictionary.`)
      return
    }

    framesRef.current = []
    setSamples(0)
    recordingRef.current = true
    setRecording(true)

    for (let second = RECORD_SECONDS; second > 0; second -= 1) {
      setCountdown(second)
      await wait(1000)
      if (!mountedRef.current) return
    }

    recordingRef.current = false
    setRecording(false)
    setCountdown(null)

    const frames = framesRef.current
    framesRef.current = []

    if (!frames.length) {
      setFormError('No hand was detected during those 3 seconds. Try again inside the frame.')
      return
    }

    // Average the captured frames so a single shaky frame cannot define the gesture.
    const landmarks = averageFrames(frames) || frames[frames.length - 1]

    setSaving(true)
    try {
      const { data } = await api.post('/api/gestures', {
        name,
        landmarks_json: JSON.stringify(landmarks)
      })
      if (!mountedRef.current) return
      const saved = data.gesture || { id: Date.now(), name, landmarks_json: JSON.stringify(landmarks) }
      setGestures((prev) => [saved, ...prev])
      setGestureName('')
      setNotice(`"${saved.name}" saved from ${frames.length} frames.`)
    } catch (error) {
      if (!mountedRef.current) return
      setFormError(getErrorMessage(error, 'Could not save the gesture.'))
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  const handleDelete = async (gesture) => {
    setNotice('')
    setFormError('')
    setDeletingId(gesture.id)
    try {
      await api.delete(`/api/gestures/${gesture.id}`)
      if (!mountedRef.current) return
      setGestures((prev) => prev.filter((item) => item.id !== gesture.id))
      setNotice(`"${gesture.name}" deleted.`)
    } catch (error) {
      if (!mountedRef.current) return
      setFormError(getErrorMessage(error, 'Could not delete that gesture.'))
    } finally {
      if (mountedRef.current) setDeletingId(null)
    }
  }

  if (!isAdmin) return <AdminOnlyNotice />

  const busy = recording || saving

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      {/* ── Camera stage ─────────────────────────────────────────────── */}
      <div className="xl:col-span-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`stage aspect-4/3 ${handVisible ? 'stage-live' : ''}`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
          />

          {/* Viewfinder brackets */}
          <span className="bracket top-4 left-4 border-t-2 border-l-2 rounded-tl-md" />
          <span className="bracket top-4 right-4 border-t-2 border-r-2 rounded-tr-md" />
          <span className="bracket bottom-4 left-4 border-b-2 border-l-2 rounded-bl-md" />
          <span className="bracket bottom-4 right-4 border-b-2 border-r-2 rounded-br-md" />
          {cameraState === 'live' && <span className="scanline" />}

          {/* Status chip */}
          <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/10 bg-black/55 px-3.5 py-1.5 backdrop-blur-md">
            {cameraState === 'live' ? (
              <>
                <span className="pulse-dot" />
                <span className="font-mono text-[0.625rem] tracking-[0.2em] text-white/70 uppercase">
                  {handVisible ? 'Hand locked' : 'Searching for hand'}
                </span>
              </>
            ) : (
              <span className="font-mono text-[0.625rem] tracking-[0.2em] text-white/60 uppercase">
                {cameraState === 'error' ? 'Camera offline' : 'Loading model'}
              </span>
            )}
          </div>

          {/* Countdown */}
          <AnimatePresence>
            {recording && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[2px]"
              >
                <div className="relative grid place-items-center">
                  <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="#c6ff3d"
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ pathLength: 1 }}
                      animate={{ pathLength: 0 }}
                      transition={{ duration: RECORD_SECONDS, ease: 'linear' }}
                    />
                  </svg>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={countdown}
                      initial={{ opacity: 0, scale: 1.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="font-display absolute text-7xl font-semibold text-white"
                    >
                      {countdown}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <p className="micro absolute bottom-10 text-[#c6ff3d]">
                  Recording · {samples} frames captured
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Camera failure */}
          {cameraState === 'error' && (
            <div className="absolute inset-0 grid place-items-center bg-[#08080e]/92 px-8 text-center">
              <div>
                <span aria-hidden="true" className="block text-3xl">
                  📷
                </span>
                <p className="mt-4 text-sm text-white/70">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-ghost mt-6 rounded-xl px-5 py-2 text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="micro">
            21 landmarks · {RECORD_SECONDS}s capture · averaged fingerprint
          </p>
          <p className="micro">
            {handVisible ? 'Signal: strong' : 'Signal: none'}
          </p>
        </div>
      </div>

      {/* ── Controls + library ───────────────────────────────────────── */}
      <div className="space-y-8 xl:col-span-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="panel rounded-[1.5rem] p-6 sm:p-7"
        >
          <p className="micro">New entry</p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">
            Teach a gesture
          </h2>

          <label className="mt-6 block">
            <span className="micro mb-2 block">Gesture name</span>
            <input
              type="text"
              className="field"
              placeholder="e.g. Hello, Yes, Thank you"
              value={gestureName}
              maxLength={40}
              onChange={(event) => {
                setGestureName(event.target.value)
                if (formError) setFormError('')
              }}
              disabled={busy}
            />
          </label>

          <button
            type="button"
            onClick={handleRecord}
            disabled={busy || cameraState !== 'live'}
            className="btn-signal mt-5 w-full rounded-xl py-3.5"
          >
            <span className="relative z-10 flex items-center justify-center gap-2.5">
              {recording ? `Recording… ${countdown}` : saving ? 'Saving…' : `Record ${RECORD_SECONDS}s`}
              {!busy && <span aria-hidden="true">●</span>}
            </span>
          </button>

          <AnimatePresence mode="wait">
            {(formError || notice) && (
              <motion.p
                key={formError || notice}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                  formError
                    ? 'border-red-500/25 bg-red-500/8 text-red-200'
                    : 'border-[#c6ff3d]/25 bg-[#c6ff3d]/8 text-[#e6ffb0]'
                }`}
              >
                {formError || notice}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="mt-5 text-xs leading-relaxed text-white/35">
            Hold the sign steady inside the frame for the full countdown. Every frame with a
            detected hand is averaged into one 21-point fingerprint.
          </p>
        </motion.div>

        {/* Saved gestures */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-end justify-between border-b border-white/8 pb-3">
            <h3 className="font-display text-lg font-medium text-white">Trained gestures</h3>
            <span className="micro">{gestures.length} total</span>
          </div>

          {loadingList ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl border border-white/6 bg-white/3"
                  style={{ animationDelay: `${index * 120}ms` }}
                />
              ))}
            </div>
          ) : listError ? (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {listError}
              <button
                type="button"
                onClick={loadGestures}
                className="ml-3 underline decoration-red-400/60 underline-offset-4"
              >
                Retry
              </button>
            </div>
          ) : gestures.length === 0 ? (
            <p className="mt-6 text-sm text-white/40">
              Nothing trained yet. Record your first gesture above.
            </p>
          ) : (
            <ul className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {gestures.map((gesture, index) => (
                  <motion.li
                    key={gesture.id}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="panel panel-hover flex items-center justify-between gap-4 rounded-xl px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-medium text-white">
                        {gesture.name}
                      </p>
                      <p className="micro mt-1">
                        {parseLandmarks(gesture.landmarks_json).length} landmarks
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(gesture)}
                      disabled={deletingId === gesture.id}
                      className="btn-danger shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium"
                    >
                      {deletingId === gesture.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  )
}
