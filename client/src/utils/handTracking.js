import * as handsModule from '@mediapipe/hands'
import * as cameraModule from '@mediapipe/camera_utils'

/**
 * The MediaPipe solution bundles are UMD builds: depending on how the bundler
 * interops them the symbols land either on the module namespace or on `window`.
 * Resolving lazily (at call time) covers both dev pre-bundling and the Rollup
 * production build.
 */
const resolveHandsCtor = () =>
  handsModule.Hands || handsModule.default?.Hands || globalThis.Hands

const resolveCameraCtor = () =>
  cameraModule.Camera || cameraModule.default?.Camera || globalThis.Camera

/**
 * The wasm/model assets are streamed from jsDelivr, pinned to the exact version
 * of the installed solution so the glue code and the binaries always match.
 */
const SOLUTION_VERSION =
  handsModule.VERSION || handsModule.default?.VERSION || globalThis.VERSION || ''

export const CDN_BASE = SOLUTION_VERSION
  ? `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${SOLUTION_VERSION}`
  : 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'

/** Index pairs describing the 21-point hand skeleton. */
export const HAND_CONNECTIONS =
  handsModule.HAND_CONNECTIONS ||
  handsModule.default?.HAND_CONNECTIONS ||
  globalThis.HAND_CONNECTIONS || [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
  ]

const FINGERTIPS = [4, 8, 12, 16, 20]
const PALM = [0, 1, 5, 9, 13, 17]

/** Creates a configured MediaPipe Hands instance loading its wasm assets from the CDN. */
export function createHands() {
  const HandsCtor = resolveHandsCtor()
  if (!HandsCtor) {
    throw new Error('MediaPipe Hands could not be loaded.')
  }

  const hands = new HandsCtor({
    locateFile: (file) => `${CDN_BASE}/${file}`
  })

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  })

  return hands
}

/** Wires the webcam into a frame callback. */
export function createCamera(videoElement, onFrame, { width = 640, height = 480 } = {}) {
  const CameraCtor = resolveCameraCtor()
  if (!CameraCtor) {
    throw new Error('MediaPipe camera utils could not be loaded.')
  }
  return new CameraCtor(videoElement, { onFrame, width, height })
}

/** Stops a camera and disposes a Hands instance without throwing during teardown. */
export function teardownTracking(camera, hands) {
  try {
    camera?.stop()
  } catch {
    /* camera already stopped */
  }

  // Release the underlying MediaStream: Camera.stop() only pauses the loop.
  try {
    const stream = camera?.video?.srcObject
    stream?.getTracks?.().forEach((track) => track.stop())
    if (camera?.video) camera.video.srcObject = null
  } catch {
    /* nothing to release */
  }

  try {
    hands?.close()
  } catch {
    /* solution already closed */
  }
}

/** Sizes the overlay canvas to the incoming video frame. */
export function syncCanvasSize(canvas, image) {
  const width = image?.videoWidth || image?.width || canvas.width
  const height = image?.videoHeight || image?.height || canvas.height
  if (width && height && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width
    canvas.height = height
  }
}

/**
 * Draws the skeleton for one hand: translucent palm, gradient bones, glowing
 * joints and acid-coloured fingertips.
 */
export function drawHandOverlay(ctx, landmarks, { accent = '#c6ff3d' } = {}) {
  if (!landmarks?.length) return

  const { width: w, height: h } = ctx.canvas
  const px = (point) => [point.x * w, point.y * h]

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Palm fill
  ctx.beginPath()
  PALM.forEach((index, i) => {
    const [x, y] = px(landmarks[index])
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = 'rgba(139, 92, 246, 0.16)'
  ctx.fill()

  // Bones
  const gradient = ctx.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, '#a78bfa')
  gradient.addColorStop(1, '#60a5fa')

  ctx.shadowColor = 'rgba(139, 92, 246, 0.85)'
  ctx.shadowBlur = 14
  ctx.strokeStyle = gradient
  ctx.lineWidth = Math.max(2.5, w / 220)
  ctx.beginPath()
  HAND_CONNECTIONS.forEach(([from, to]) => {
    const a = landmarks[from]
    const b = landmarks[to]
    if (!a || !b) return
    const [ax, ay] = px(a)
    const [bx, by] = px(b)
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
  })
  ctx.stroke()

  // Joints
  const jointRadius = Math.max(3, w / 190)
  landmarks.forEach((point, index) => {
    const tip = FINGERTIPS.includes(index)
    const [x, y] = px(point)
    ctx.beginPath()
    ctx.arc(x, y, tip ? jointRadius * 1.5 : jointRadius, 0, Math.PI * 2)
    ctx.fillStyle = tip ? accent : '#f8fafc'
    ctx.shadowColor = tip ? accent : 'rgba(96, 165, 250, 0.9)'
    ctx.shadowBlur = tip ? 18 : 8
    ctx.fill()
  })

  ctx.restore()
}

/**
 * Euclidean similarity between a live hand and a stored gesture.
 * Returns a 0..1 score where 1 is an exact match.
 */
export function compareLandmarks(live, saved) {
  if (!live || !saved || live.length !== saved.length) return 0
  let totalDist = 0
  for (let i = 0; i < live.length; i++) {
    const dx = live[i].x - saved[i].x
    const dy = live[i].y - saved[i].y
    const dz = (live[i].z || 0) - (saved[i].z || 0)
    totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  const avgDist = totalDist / live.length
  const score = Math.max(0, 1 - avgDist / 0.4)
  return score
}

/** Keeps only {x, y, z} so stored payloads stay small and comparable. */
export function toPlainLandmarks(landmarks) {
  return landmarks.map(({ x, y, z }) => ({
    x: Number(x.toFixed(5)),
    y: Number(y.toFixed(5)),
    z: Number((z || 0).toFixed(5))
  }))
}

/** Averages a series of captured frames into a single reference gesture. */
export function averageFrames(frames) {
  if (!frames.length) return null
  const count = frames[0].length
  const averaged = []
  for (let i = 0; i < count; i++) {
    let x = 0
    let y = 0
    let z = 0
    for (const frame of frames) {
      x += frame[i].x
      y += frame[i].y
      z += frame[i].z || 0
    }
    averaged.push({ x: x / frames.length, y: y / frames.length, z: z / frames.length })
  }
  return toPlainLandmarks(averaged)
}

/** Safely parses a stored landmarks_json column. */
export function parseLandmarks(json) {
  if (!json) return []
  if (Array.isArray(json)) return json
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
