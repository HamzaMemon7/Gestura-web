import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import api, { getErrorMessage } from '../utils/api'
import {
  createHands, createCamera, teardownTracking,
  syncCanvasSize, drawHandOverlay,
  compareLandmarks, parseLandmarks,
  HAND_CONNECTIONS
} from '../utils/handTracking'
import ConfirmationPopup from './ConfirmationPopup'

const MATCH_THRESHOLD = 0.8
const HOLD_DURATION = 2000 // 2 seconds in ms
const RING_CIRCUMFERENCE = 2 * Math.PI * 54
const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

export default function BuilderTab() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const mountedRef = useRef(true)
  const cameraRef = useRef(null)
  const handsRef = useRef(null)
  const readingRef = useRef({ name: '', score: 0, hand: false, id: null })
  const gesturesRef = useRef([])
  const holdStartRef = useRef(0)
  const confirmStateRef = useRef('idle')
  const pendingDetectionRef = useRef({ id: null, name: '', confidence: 0 })

  const [cameraState, setCameraState] = useState('booting')
  const [cameraError, setCameraError] = useState('')
  const [reading, setReading] = useState({ name: '', score: 0, hand: false, id: null })
  const [gestures, setGestures] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [sentence, setSentence] = useState('')
  const [confirmState, setConfirmState] = useState('idle')
  const [pendingWord, setPendingWord] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [translatedText, setTranslatedText] = useState('')
  const [translating, setTranslating] = useState(false)
  const [targetLang, setTargetLang] = useState('es')
  const [speaking, setSpeaking] = useState(false)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Save')

  const matched = reading.hand && reading.score >= MATCH_THRESHOLD
  const confidence = Math.round(reading.score * 100)
  const landmarkCount = useMemo(() => new Set(HAND_CONNECTIONS.flat()).size, [])
  const dictionarySize = useMemo(
    () => gestures.filter((gesture) => gesture.landmarks?.length).length,
    [gestures]
  )

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

  const handleResults = useCallback((results) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    syncCanvasSize(canvas, results.image)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = results.multiHandLandmarks?.[0]
    if (!landmarks?.length) {
      readingRef.current = { name: '', score: 0, hand: false, id: null }
      return
    }

    drawHandOverlay(ctx, landmarks, {
      accent: readingRef.current.score >= MATCH_THRESHOLD ? '#c6ff3d' : '#60a5fa'
    })

    const best = gesturesRef.current
      .map((gesture) => ({
        id: gesture.id,
        name: gesture.name,
        score: compareLandmarks(landmarks, gesture.landmarks)
      }))
      .sort((a, b) => b.score - a.score)[0]

    readingRef.current = {
      id: best?.id ?? null,
      name: best?.name || '',
      score: best?.score || 0,
      hand: true
    }
  }, [])

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
      teardownTracking(camera, hands)
      handsRef.current = null
      cameraRef.current = null
    }
  }, [handleResults])

  useEffect(() => {
    const id = setInterval(() => {
      const next = readingRef.current
      setReading((prev) =>
        prev.hand === next.hand &&
        prev.name === next.name &&
        prev.id === next.id &&
        Math.abs(prev.score - next.score) < 0.01
          ? prev
          : { name: next.name, score: next.score, hand: next.hand, id: next.id }
      )

      const isMatch = next.hand && next.score >= MATCH_THRESHOLD
      if (isMatch && confirmStateRef.current === 'idle') {
        holdStartRef.current = Date.now()
        setHoldProgress(0)
        setConfirmState('holding')
      } else if (confirmStateRef.current === 'holding') {
        if (isMatch) {
          const elapsed = Date.now() - holdStartRef.current
          setHoldProgress(Math.min(1, elapsed / HOLD_DURATION))
          if (elapsed >= HOLD_DURATION) {
            pendingDetectionRef.current = { id: next.id, name: next.name, confidence: next.score }
            setConfirmState('confirming')
            setPendingWord(next.name)
          }
        } else {
          setConfirmState('idle')
          setHoldProgress(0)
        }
      }
    }, 140)
    return () => clearInterval(id)
  }, [])

  const handleConfirm = () => {
    const pending = pendingDetectionRef.current
    const word = pending.name.trim()
    if (!word) return
    setSentence((current) => [current.trim(), word].filter(Boolean).join(' '))
    void api.post('/api/detections', {
      gesture_id: pending.id,
      gesture_name: pending.name,
      confidence: pending.confidence
    }).catch(() => {})
    pendingDetectionRef.current = { id: null, name: '', confidence: 0 }
    setPendingWord('')
    setHoldProgress(0)
    setConfirmState('idle')
  }

  const handleDismiss = () => {
    pendingDetectionRef.current = { id: null, name: '', confidence: 0 }
    setPendingWord('')
    setConfirmState('idle')
    setHoldProgress(0)
  }

  const handleSpeak = () => {
    if (!sentence.trim() || !SPEECH_SUPPORTED) {
      if (!SPEECH_SUPPORTED) setActionError('Speech is not supported by this browser.')
      return
    }
    setActionError('')
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(sentence)
    utterance.onstart = () => mountedRef.current && setSpeaking(true)
    utterance.onend = () => mountedRef.current && setSpeaking(false)
    utterance.onerror = () => mountedRef.current && setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const handleTranslate = async () => {
    if (!sentence.trim()) return
    setTranslating(true)
    setActionError('')
    try {
      const { data } = await api.post('/api/translate', { text: sentence, targetLang })
      if (!mountedRef.current) return
      setTranslatedText(data.translation || data.translatedText || data.text || '')
    } catch (error) {
      if (!mountedRef.current) return
      setActionError(getErrorMessage(error, 'Could not translate this sentence.'))
    } finally {
      if (mountedRef.current) setTranslating(false)
    }
  }

  const handleSave = async () => {
    if (!sentence.trim() || saving) return
    setSaving(true)
    setSaveLabel('Saving…')
    try {
      await api.post('/api/sentences', { text: sentence.trim() })
      setSaveLabel('Saved!')
      setTimeout(() => { if (mountedRef.current) setSaveLabel('Save') }, 1500)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not save sentence.'))
      setSaveLabel('Save')
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  const handleClear = () => {
    setSentence('')
    setTranslatedText('')
    setActionError('')
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`stage aspect-4/3 ${cameraState === 'live' ? 'stage-live' : ''}`}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover"
            />

            {cameraState === 'live' && <span className="scanline" />}
            <span className="bracket top-4 left-4 rounded-tl-md border-t-2 border-l-2" />
            <span className="bracket top-4 right-4 rounded-tr-md border-t-2 border-r-2" />
            <span className="bracket bottom-4 left-4 rounded-bl-md border-b-2 border-l-2" />
            <span className="bracket right-4 bottom-4 rounded-br-md border-r-2 border-b-2" />

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

            <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/10 bg-black/55 px-3.5 py-1.5 backdrop-blur-md">
              {cameraState === 'live' && <span className="pulse-dot" />}
              <span className="font-mono text-[0.625rem] tracking-[0.2em] text-white/70 uppercase">
                {cameraState === 'error' ? 'Camera offline' : cameraState === 'live' ? 'Sentence capture' : 'Loading model'}
              </span>
            </div>

            {cameraState === 'error' && (
              <div className="absolute inset-0 grid place-items-center bg-[#08080e]/92 px-8 text-center">
                <div>
                  <p className="text-sm text-white/70">{cameraError}</p>
                  <button type="button" onClick={() => window.location.reload()} className="btn-ghost mt-6 rounded-xl px-5 py-2 text-sm">
                    Retry
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="micro">
              {matched ? `${reading.name} · ${confidence}% match` : 'Waiting for gesture…'}
            </p>
            <p className="micro">{landmarkCount} landmarks · {dictionarySize} gestures</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="panel rounded-[1.35rem] p-5"
          >
            <p className="micro mb-1">Currently detecting</p>
            <div className="flex items-end justify-between gap-3">
              <p className={`font-display text-2xl font-semibold ${matched ? 'text-white' : 'text-white/40'}`}>
                {matched ? reading.name : 'No gesture'}
              </p>
              <span className="font-mono text-xs text-white/40">{reading.hand ? `${confidence}%` : '--%'}</span>
            </div>
            {confirmState === 'holding' && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all"
                  style={{ width: `${holdProgress * 100}%` }}
                />
              </div>
            )}
          </motion.div>

          <div className="panel rounded-[1.35rem] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="micro">Your sentence</p>
              <span className="font-mono text-[0.65rem] text-white/30">{sentence.trim() ? sentence.trim().split(/\s+/).length : 0} words</span>
            </div>
            <textarea
              readOnly
              value={sentence}
              className="field min-h-[140px] w-full resize-none leading-relaxed"
              placeholder="Confirmed gestures will appear here…"
            />
          </div>

          <AnimatePresence>
            {translatedText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="panel rounded-[1.35rem] p-5"
              >
                <p className="micro mb-2">Translation</p>
                <p className="leading-relaxed text-white/80">{translatedText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {(listError || actionError) && (
            <p className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {listError || actionError}
            </p>
          )}
          {loading && <p className="micro animate-pulse">Loading gesture dictionary…</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="btn-signal flex-1 rounded-xl px-4 py-3"
              onClick={handleSpeak}
              disabled={!sentence.trim() || speaking}
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
                className="btn-ghost flex-1 rounded-xl px-3 py-3 text-sm"
                onClick={handleTranslate}
                disabled={!sentence.trim() || translating}
              >
                {translating ? 'Translating…' : '🌐 Translate'}
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost rounded-xl px-4 py-3 text-sm font-medium"
              onClick={handleSave}
              disabled={!sentence.trim() || saving}
            >
              {saveLabel === 'Saved!' ? '✓ Saved!' : `💾 ${saveLabel}`}
            </button>
            <button
              type="button"
              className="btn-danger rounded-xl px-4 py-3"
              onClick={handleClear}
              disabled={!sentence.trim()}
            >
              Clear
            </button>
          </div>
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
