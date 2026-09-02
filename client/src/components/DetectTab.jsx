import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import api, { getErrorMessage } from '../utils/api'
import {
  compareLandmarks,
  createCamera,
  createHands,
  drawHandOverlay,
  parseLandmarks,
  syncCanvasSize,
  teardownTracking
} from '../utils/handTracking'
import ConfirmationPopup from './ConfirmationPopup'

const MATCH_THRESHOLD = 0.8
const CONFIRM_THRESHOLD = 0.7
const HOLD_DURATION = 2000
const RING_CIRCUMFERENCE = 2 * Math.PI * 54
const UNKNOWN = 'Unknown Gesture'
const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

export default function DetectTab() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const handsRef = useRef(null)
  const mountedRef = useRef(true)
  const gesturesRef = useRef([])
  const readingRef = useRef({ name: '', score: 0, hand: false })
  const spokenRef = useRef('')
  const holdStartRef = useRef(0)
  const confirmStateRef = useRef('idle')
  const pendingDetectionRef = useRef({ id: null, name: '', confidence: 0 })

  const [cameraState, setCameraState] = useState('booting') // booting | live | error
  const [cameraError, setCameraError] = useState('')
  const [reading, setReading] = useState({ name: '', score: 0, hand: false })
  const [ranking, setRanking] = useState([])

  const [gestures, setGestures] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [recentActivity, setRecentActivity] = useState([])
  const [confirmState, setConfirmState] = useState('idle')
  const [pendingWord, setPendingWord] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [detectedGesture, setDetectedGesture] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [translating, setTranslating] = useState(false)
  const [targetLang, setTargetLang] = useState('es')
  const lastLoggedRef = useRef('')

  const matched = reading.hand && reading.score >= MATCH_THRESHOLD
  const label = reading.hand ? (matched ? reading.name : UNKNOWN) : 'Show a hand'
  const confidence = Math.round(reading.score * 100)

  // ── Speech ──────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!SPEECH_SUPPORTED || !text) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.onstart = () => mountedRef.current && setSpeaking(true)
    utterance.onend = () => mountedRef.current && setSpeaking(false)
    utterance.onerror = () => mountedRef.current && setSpeaking(false)
    synth.speak(utterance)
  }, [])

  // ── Gesture library ─────────────────────────────────────────────────────
  const loadGestures = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const { data } = await api.get('/api/gestures')
      const list = (Array.isArray(data.gestures) ? data.gestures : []).map((gesture) => ({
        ...gesture,
        landmarks: parseLandmarks(gesture.landmarks_json)
      }))
      gesturesRef.current = list.filter((gesture) => gesture.landmarks.length > 0)
      if (!mountedRef.current) return
      setGestures(list)
    } catch (error) {
      if (!mountedRef.current) return
      setListError(getErrorMessage(error, 'Could not load the gesture dictionary.'))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadGestures()
    return () => {
      mountedRef.current = false
      if (SPEECH_SUPPORTED) window.speechSynthesis.cancel()
    }
  }, [loadGestures])

  useEffect(() => {
    confirmStateRef.current = confirmState
  }, [confirmState])

  /** Scores the live hand against every stored gesture. */
  const handleResults = useCallback((results) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    syncCanvasSize(canvas, results.image)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = results.multiHandLandmarks?.[0]
    if (!landmarks?.length) {
      readingRef.current = { name: '', score: 0, hand: false, scores: [] }
      readingRef.current.id = null
      return
    }

    drawHandOverlay(ctx, landmarks, {
      accent: readingRef.current.score >= MATCH_THRESHOLD ? '#c6ff3d' : '#60a5fa'
    })

    const scores = gesturesRef.current
      .map((gesture) => ({
        id: gesture.id,
        name: gesture.name,
        score: compareLandmarks(landmarks, gesture.landmarks)
      }))
      .sort((a, b) => b.score - a.score)

    const best = scores[0]
    readingRef.current = {
      id: best?.id ?? null,
      name: best?.name || '',
      score: best?.score || 0,
      hand: true,
      scores: scores.slice(0, 3)
    }
  }, [])

  // ── Camera + MediaPipe lifecycle ────────────────────────────────────────
  useEffect(() => {
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
      teardownTracking(camera, hands)
      handsRef.current = null
    }
  }, [handleResults])

  // Publish readings on a timer instead of on every frame to keep renders cheap.
  useEffect(() => {
    const id = setInterval(() => {
      const next = readingRef.current
      setReading((prev) =>
        prev.hand === next.hand && prev.name === next.name && Math.abs(prev.score - next.score) < 0.01
          ? prev
          : { name: next.name, score: next.score, hand: next.hand }
      )
      setReading((prev) =>
        prev.id === next.id ? prev : { ...prev, id: next.id }
      )
      setRanking(next.scores || [])

      const isConfirmMatch = next.hand && next.score > CONFIRM_THRESHOLD && Boolean(next.name)
      if (isConfirmMatch && confirmStateRef.current === 'idle') {
        holdStartRef.current = Date.now()
        pendingDetectionRef.current = {
          id: next.id,
          name: next.name,
          confidence: next.score
        }
        confirmStateRef.current = 'holding'
        setHoldProgress(0)
        setConfirmState('holding')
      } else if (confirmStateRef.current === 'holding') {
        const pending = pendingDetectionRef.current
        const isSameGesture = isConfirmMatch && next.id === pending.id && next.name === pending.name
        if (isSameGesture) {
          const elapsed = Date.now() - holdStartRef.current
          setHoldProgress(Math.min(1, elapsed / HOLD_DURATION))
          if (elapsed >= HOLD_DURATION) {
            pendingDetectionRef.current = {
              id: next.id,
              name: next.name,
              confidence: next.score
            }
            confirmStateRef.current = 'confirming'
            setPendingWord(next.name)
            setConfirmState('confirming')
          }
        } else {
          pendingDetectionRef.current = { id: null, name: '', confidence: 0 }
          confirmStateRef.current = 'idle'
          setHoldProgress(0)
          setConfirmState('idle')
        }
      }
    }, 140)
    return () => clearInterval(id)
  }, [])

  const handleConfirm = useCallback(() => {
    const pending = pendingDetectionRef.current
    if (!pending.name.trim()) return

    setDetectedGesture(pending.name)
    setTranslatedText('')
    void api.post('/api/detections', {
      gesture_id: pending.id,
      gesture_name: pending.name,
      confidence: pending.confidence
    }).then(({ data }) => {
      if (mountedRef.current && data.detection) {
        setRecentActivity((previous) => [data.detection, ...previous].slice(0, 10))
      }
    }).catch(() => {})

    pendingDetectionRef.current = { id: null, name: '', confidence: 0 }
    confirmStateRef.current = 'idle'
    setPendingWord('')
    setHoldProgress(0)
    setConfirmState('idle')
  }, [])

  const handleDismiss = useCallback(() => {
    pendingDetectionRef.current = { id: null, name: '', confidence: 0 }
    confirmStateRef.current = 'idle'
    setPendingWord('')
    setHoldProgress(0)
    setConfirmState('idle')
  }, [])

  const handleSpeakDetected = () => {
    speak(detectedGesture)
  }

  const handleTranslateDetected = async () => {
    if (!detectedGesture) return
    setTranslating(true)
    setTranslatedText('')
    try {
      const { data } = await api.post('/api/translate', { text: detectedGesture, targetLang })
      if (mountedRef.current) {
        setTranslatedText(data.translation || data.translatedText || data.text || '')
      }
    } catch {
      if (mountedRef.current) setTranslatedText('Translation unavailable. Please try again.')
    } finally {
      if (mountedRef.current) setTranslating(false)
    }
  }

  // Optional hands-free speech: announce each newly recognised gesture once.
  useEffect(() => {
    if (!autoSpeak) {
      spokenRef.current = ''
      return
    }
    if (matched && reading.name && spokenRef.current !== reading.name) {
      spokenRef.current = reading.name
      speak(reading.name)
    }
    if (!matched) spokenRef.current = ''
  }, [autoSpeak, matched, reading.name, speak])

  useEffect(() => {
    if (!mountedRef.current) return
    const matched = reading.hand && reading.score >= MATCH_THRESHOLD
    if (matched && reading.name && lastLoggedRef.current !== reading.name) {
      lastLoggedRef.current = reading.name
      api.post('/api/detections', {
        gesture_id: reading.id || null,
        gesture_name: reading.name,
        confidence: reading.score
      }).then(({ data }) => {
        if (mountedRef.current) {
          setRecentActivity(prev => [data.detection, ...prev].slice(0, 10))
        }
      }).catch(() => {}) // fire-and-forget
    }
    if (!matched) {
      lastLoggedRef.current = ''
    }
  }, [reading])

  useEffect(() => {
    api.get('/api/detections/me')
      .then(({ data }) => {
        if (mountedRef.current) setRecentActivity(data.detections || [])
      })
      .catch(() => {})
  }, [])

  const dictionarySize = useMemo(
    () => gestures.filter((gesture) => gesture.landmarks?.length).length,
    [gestures]
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      {/* ── Camera stage ─────────────────────────────────────────────── */}
      <div className="xl:col-span-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`stage aspect-4/3 ${matched ? 'stage-live' : ''}`}
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

          <span className="bracket top-4 left-4 border-t-2 border-l-2 rounded-tl-md" />
          <span className="bracket top-4 right-4 border-t-2 border-r-2 rounded-tr-md" />
          <span className="bracket bottom-4 left-4 border-b-2 border-l-2 rounded-bl-md" />
          <span className="bracket bottom-4 right-4 border-b-2 border-r-2 rounded-br-md" />
          {cameraState === 'live' && <span className="scanline" />}

          <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/10 bg-black/55 px-3.5 py-1.5 backdrop-blur-md">
            {cameraState === 'live' ? (
              <>
                <span className="pulse-dot" />
                <span className="font-mono text-[0.625rem] tracking-[0.2em] text-white/70 uppercase">
                  Live detection
                </span>
              </>
            ) : (
              <span className="font-mono text-[0.625rem] tracking-[0.2em] text-white/60 uppercase">
                {cameraState === 'error' ? 'Camera offline' : 'Loading model'}
              </span>
            )}
          </div>

          {/* Big read-out overlaid on the feed */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-6 pt-14 pb-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={label}
                initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`font-display text-[clamp(1.8rem,4.6vw,3.2rem)] leading-none font-semibold tracking-[-0.03em] ${
                  matched ? 'text-[#c6ff3d]' : 'text-white/80'
                }`}
              >
                {label}
              </motion.p>
            </AnimatePresence>
            <div className="mt-3 flex items-center gap-4">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/12">
                <motion.div
                  animate={{ width: `${reading.hand ? confidence : 0}%` }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    matched
                      ? 'bg-[#c6ff3d]'
                      : 'bg-gradient-to-r from-violet-500 to-blue-500'
                  }`}
                />
              </div>
              <span className="font-mono text-xs tracking-[0.16em] text-white/60 tabular-nums">
                {reading.hand ? `${confidence}%` : '--%'}
              </span>
            </div>
          </div>

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

          <AnimatePresence>
            {confirmState === 'holding' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.06 }}
                className="absolute inset-0 grid place-items-center bg-black/20 backdrop-blur-[1px]"
              >
                <div className="relative grid place-items-center">
                  <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90 drop-shadow-[0_0_20px_rgba(198,255,61,0.3)]">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="4" />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="#c6ff3d"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - holdProgress) }}
                      transition={{ duration: 0.14, ease: 'linear' }}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <p className="font-display text-2xl font-semibold text-white">Hold</p>
                    <p className="font-mono text-xs text-[#c6ff3d] tabular-nums">
                      {Math.round(holdProgress * 100)}%
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="micro">Threshold · {Math.round(MATCH_THRESHOLD * 100)}% match</p>
          <p className="micro">Dictionary · {dictionarySize} gestures loaded</p>
        </div>

        {detectedGesture && (
          <motion.div className="panel mt-6 rounded-[1.35rem] p-5">
            <p className="micro mb-2">Detected gesture</p>
            <p className="font-display text-2xl font-semibold text-[#c6ff3d]">
              {detectedGesture}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleSpeakDetected}
                disabled={!SPEECH_SUPPORTED || speaking}
                className="btn-signal flex-1 rounded-xl px-4 py-3"
              >
                <span className="relative z-10">{speaking ? 'Speaking…' : '🔊 Speak'}</span>
              </button>
              <div className="flex flex-[2] items-center gap-2">
                <select
                  value={targetLang}
                  onChange={(event) => setTargetLang(event.target.value)}
                  className="field min-w-28 px-2 py-3 text-sm"
                  aria-label="Translation language"
                >
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ar">Arabic</option>
                  <option value="zh">Chinese</option>
                  <option value="hi">Hindi</option>
                  <option value="ur">Urdu</option>
                </select>
                <button
                  type="button"
                  onClick={handleTranslateDetected}
                  disabled={translating || !detectedGesture}
                  className="btn-ghost flex-1 rounded-xl px-3 py-3 text-sm"
                >
                  {translating ? 'Translating…' : '🌐 Translate'}
                </button>
              </div>
            </div>
            {translatedText && (
              <div className="mt-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                <p className="micro mb-1">Translation</p>
                <p className="text-white/80">{translatedText}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Read-out panel ───────────────────────────────────────────── */}
      <div className="space-y-8 xl:col-span-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="panel relative overflow-hidden rounded-[1.5rem] p-6 sm:p-7"
        >
          <p className="micro">Recognised sign</p>

          <AnimatePresence mode="wait">
            <motion.h2
              key={label}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.04, y: -10 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className={`font-display mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] font-semibold tracking-[-0.03em] break-words ${
                matched ? 'text-white' : 'text-white/45'
              }`}
            >
              {label}
            </motion.h2>
          </AnimatePresence>

          {/* Confidence dial */}
          <div className="mt-6 flex items-center gap-5">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={matched ? '#c6ff3d' : '#8b5cf6'}
                  strokeWidth="5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: reading.hand ? reading.score : 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </svg>
              <span className="absolute font-mono text-sm text-white tabular-nums">
                {reading.hand ? confidence : '--'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/70">
                {!reading.hand
                  ? 'No hand in frame.'
                  : matched
                    ? 'Confident match against the dictionary.'
                    : 'Closest entry is below the 80% threshold.'}
              </p>
              {reading.hand && reading.name && (
                <p className="micro mt-2">Closest · {reading.name}</p>
              )}
            </div>
          </div>

          {/* Speak controls */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => speak(matched ? reading.name : UNKNOWN)}
              disabled={!SPEECH_SUPPORTED || !reading.hand}
              className="btn-signal flex-1 rounded-xl py-3.5"
            >
              <span className="relative z-10 flex items-center justify-center gap-2.5 tracking-[0.08em]">
                {speaking ? 'SPEAKING…' : 'SPEAK'}
                <span aria-hidden="true">🔊</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAutoSpeak((value) => !value)}
              disabled={!SPEECH_SUPPORTED}
              className={`rounded-xl px-4 py-3.5 text-sm font-medium transition-colors ${
                autoSpeak
                  ? 'border border-[#c6ff3d]/40 bg-[#c6ff3d]/12 text-[#e6ffb0]'
                  : 'btn-ghost'
              }`}
            >
              Auto {autoSpeak ? 'on' : 'off'}
            </button>
          </div>

          {!SPEECH_SUPPORTED && (
            <p className="mt-3 text-xs text-white/35">
              This browser does not expose the Web Speech API.
            </p>
          )}
        </motion.div>

        {/* Live ranking */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-end justify-between border-b border-white/8 pb-3">
            <h3 className="font-display text-lg font-medium text-white">Closest matches</h3>
            <span className="micro">Live</span>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl border border-white/6 bg-white/3" />
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
          ) : dictionarySize === 0 ? (
            <p className="mt-6 text-sm text-white/40">
              The dictionary is empty, so there is nothing to match against yet.
            </p>
          ) : ranking.length === 0 ? (
            <p className="mt-6 text-sm text-white/40">
              Raise your hand into the frame to start scoring.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {ranking.map((item, index) => {
                const percent = Math.round(item.score * 100)
                const isTop = index === 0
                return (
                  <li
                    key={item.id ?? item.name}
                    className="relative overflow-hidden rounded-xl border border-white/8 bg-white/2 px-4 py-3"
                  >
                    <motion.span
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className={`absolute inset-y-0 left-0 ${
                        isTop && item.score >= MATCH_THRESHOLD
                          ? 'bg-[#c6ff3d]/14'
                          : 'bg-violet-500/12'
                      }`}
                    />
                    <span className="relative flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-white/85">{item.name}</span>
                      <span className="font-mono text-xs text-white/55 tabular-nums">{percent}%</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <p className="micro mb-3">Recent Activity</p>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-white/40">Your recent detections will appear here once you start signing.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.slice(0, 10).map((det, i) => (
                <div key={det.id || i} className="panel flex items-center justify-between px-4 py-2">
                  <span className="text-sm font-medium text-white">{det.gesture_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">
                      {det.confidence != null ? `${Math.round(det.confidence * 100)}%` : ''}
                    </span>
                    <span className="text-xs text-white/30">
                      {det.created_at ? new Date(det.created_at).toLocaleTimeString() : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      </div>

      <AnimatePresence>
        {confirmState === 'confirming' && pendingWord && (
          <ConfirmationPopup
            gestureName={pendingWord}
            onConfirm={handleConfirm}
            onDismiss={handleDismiss}
          />
        )}
      </AnimatePresence>
    </>
  )
}
