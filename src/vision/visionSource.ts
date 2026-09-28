/**
 * Источник кадров от камеры: видео → 21 точка руки → замороженный `FrameInput`.
 *
 * Это замена моку из `mockSource.ts`: контракт тот же, поэтому игровой слой и экран PLAY
 * не знают, откуда кадр. Что здесь уже по-настоящему:
 *   · камера и её понятные ошибки (`camera.ts`), 21 точка × 2 руки (`handTracker.ts`);
 *   · кадр камеры и скелет рисуются на одном холсте из одного снимка кадра, поэтому
 *     картинка и точки не расходятся (`handOverlay.ts`);
 *   · распознавание запускается по кадрам камеры, а не по кадрам отрисовки;
 *   · прицел по указательному пальцу с зеркалированием и сглаживанием EMA (SPEC §2);
 *   · яркость кадра → метрика `brightness` и диагностика TOO_DARK (SPEC §1, §3);
 *   · `NO_HAND`, когда руки нет дольше `ENV.NO_HAND_MS`;
 *   · camera fps / hand fps / время детекции для HUD (SPEC §6);
 *   · выстрел по Space — скрытый фолбэк из SPEC §2.
 *
 * Чего здесь ещё нет (следующие шаги): признаки SPEC §1 (углы сгиба, `fistScore`,
 * `openPalmScore`, `thumbExtension`, `palmFrontality`, `palmWidthRatio`, `palmRoll`),
 * автомат выстрела IDLE → ARMED → FIRE, щит, остальные девять диагностик, калибровка.
 * До этого `HandFrame.features` заполняется нулями — честная заглушка, а не выдуманные числа.
 */

import { ENV, SMOOTH, ZERO_FEATURES } from '../shared/consts'
import { primaryDiagnostic } from '../shared/diagnostics'
import type { Diagnostic, FrameInput, Gesture, HandFrame } from '../shared/types'
import { aimPointOf, isPointing, smoothAim, type Point2 } from './aimGesture'
import { createBrightnessSampler, handBox } from './brightness'
import { startCamera, type Camera } from './camera'
import { createFpsMeter } from './fps'
import { drawOverlay } from './handOverlay'
import { createHandTracker, type DetectedHand, type HandTracker } from './handTracker'

export interface VisionSource {
  /**
   * Источник кадров камеры. В DOM не вставляется: кадр рисуется на холст оверлея
   * вместе со скелетом, чтобы картинка и точки гарантированно совпадали.
   * Нужен снаружи только чтобы узнать размер кадра (videoWidth/videoHeight).
   */
  readonly video: HTMLVideoElement
  /** Холст с кадром камеры и скелетом: рисует сам vision, у него есть все 21 точка. */
  readonly overlay: HTMLCanvasElement
  start(): Promise<void>
  /** Последний готовый кадр. Импульс выстрела отдаётся ровно один раз. */
  read(nowMs: number): FrameInput
  dispose(): void
}

/** Пустой кадр: до первой детекции и на время ошибок — чтобы игра не падала. */
export function emptyFrameInput(tMs: number): FrameInput {
  return {
    tMs,
    hands: [],
    player: { leanX: 0, duck: 0 },
    events: { shoot: false },
    diagnostics: [],
    metrics: { cameraFps: 0, detectFps: 0, poseFps: null, latencyMs: 0, brightness: 0 },
    calibration: null,
  }
}

/** Safari пока без `requestVideoFrameCallback` — тип берём отдельно, чтобы не спорить с lib.dom. */
type RvfcHost = { requestVideoFrameCallback?: (callback: (nowMs: number) => void) => number }

export function createVisionSource(): VisionSource {
  const overlay = document.createElement('canvas')
  overlay.className = 'play__overlay'

  const brightness = createBrightnessSampler()
  const cameraFps = createFpsMeter()
  const detectFps = createFpsMeter()

  let camera: Camera | null = null
  let tracker: HandTracker | null = null
  let rafId: number | null = null
  let starting = false

  let hands: DetectedHand[] = []
  let latestFrame: FrameInput | null = null
  let aim: Point2 | null = null
  let lastBrightness = 0
  let latencyMs = 0
  let lastDetectMs = Number.NEGATIVE_INFINITY
  let noHandSinceMs: number | null = null
  let pendingShoot = false

  /**
   * Снимок кадра камеры — ровно того, по которому посчитаны точки.
   * Он же рисуется на экран, поэтому скелет и картинка не могут разойтись.
   * Живёт вне DOM: `<video>` остаётся только источником кадров.
   */
  const frameCanvas = document.createElement('canvas')
  const frameCtx = frameCanvas.getContext('2d')

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'spacebar') {
      pendingShoot = true
      event.preventDefault()
    }
  }

  async function start(): Promise<void> {
    if (starting || camera !== null) return
    starting = true

    try {
      camera = await startCamera()
      tracker = await createHandTracker()
    } catch (error) {
      // камеру уже могли включить — иначе останется гореть зелёный индикатор
      camera?.stop()
      camera = null
      tracker = null
      starting = false
      throw error
    }

    starting = false
    window.addEventListener('keydown', onKeyDown)

    // Распознавание запускаем по кадрам камеры, а не по кадрам отрисовки: считаем ровно
    // один раз на новый кадр и сразу его же рисуем. Если браузер не умеет
    // requestVideoFrameCallback (Safari), откатываемся на цикл отрисовки.
    const frameDriven = startFrameLoop(camera.video)
    if (!frameDriven) rafId = requestAnimationFrame(tick)
  }

  /** true — распознавание идёт по кадрам камеры; false — нужен цикл отрисовки. */
  function startFrameLoop(video: HTMLVideoElement): boolean {
    const host = video as unknown as RvfcHost
    const schedule = host.requestVideoFrameCallback
    if (schedule === undefined) return false

    const onVideoFrame = (frameMs: number): void => {
      if (camera === null) return
      cameraFps.tick(frameMs)
      detectIfNeeded(video, frameMs)
      schedule.call(video, onVideoFrame)
    }
    schedule.call(video, onVideoFrame)
    return true
  }

  /** Резервный путь без requestVideoFrameCallback: кадры отрисовки с ограничением частоты. */
  const tick = (nowMs: number): void => {
    const video = camera?.video
    if (video === undefined) return
    rafId = requestAnimationFrame(tick)
    cameraFps.tick(nowMs)
    detectIfNeeded(video, nowMs)
  }

  function detectIfNeeded(video: HTMLVideoElement, nowMs: number): void {
    if (tracker === null || video.readyState < 2) return
    if (nowMs - lastDetectMs < SMOOTH.DETECT_INTERVAL_MS) return // не чаще тика распознавания

    lastDetectMs = nowMs

    // Снимок делаем ДО детекции и в том же синхронном блоке: элемент не успевает сменить
    // кадр между снимком и вызовом модели, поэтому точки описывают ровно ту картинку,
    // которую мы сейчас нарисуем. Иначе скелет отстаёт от руки на кадр-два, а на медленной
    // камере (7–8 кадров в секунду) это заметный сдвиг.
    const hasSnapshot = snapshotFrame(video)

    const startedAtMs = performance.now()
    hands = aimingHandFirst(tracker.detect(video, nowMs))
    latencyMs = performance.now() - startedAtMs
    detectFps.tick(nowMs)

    lastBrightness = hasSnapshot
      ? brightness.sample(frameCanvas, frameCanvas.width, frameCanvas.height, handBox(hands))
      : 0

    latestFrame = buildFrame(nowMs)
    drawOverlay(overlay, hasSnapshot ? frameCanvas : null, hands, {
      mirrored: true,
      highlight: primaryHighlight(latestFrame.diagnostics),
    })
  }

  /** Сохранить текущий кадр камеры в отдельный холст. false — кадра ещё нет. */
  function snapshotFrame(video: HTMLVideoElement): boolean {
    const width = video.videoWidth
    const height = video.videoHeight
    if (frameCtx === null || width === 0 || height === 0) return false
    if (frameCanvas.width !== width || frameCanvas.height !== height) {
      frameCanvas.width = width
      frameCanvas.height = height
    }
    frameCtx.drawImage(video, 0, 0)
    return true
  }

  function buildFrame(nowMs: number): FrameInput {
    const aimHand = hands[0]
    const pointing = aimHand !== undefined && isPointing(aimHand.landmarks)

    if (!pointing || aimHand === undefined) {
      aim = null
    } else {
      const raw = aimPointOf(aimHand.landmarks)
      aim = raw === null ? null : smoothAim(aim, raw, SMOOTH.AIM_EMA)
    }

    const handFrames: HandFrame[] = hands.map((hand, index) => {
      const isAimHand = index === 0
      const handAim = isAimHand ? aim : aimPointOf(hand.landmarks)
      const gesture: Gesture = (isAimHand ? pointing : isPointing(hand.landmarks)) ? 'AIM' : 'NONE'
      return {
        gesture,
        handedness: hand.handedness,
        x: handAim === null ? 0 : handAim.x,
        y: handAim === null ? 0 : handAim.y,
        confidence: hand.score,
        // признаки SPEC §1 — следующий шаг; пустой снапшот вместо выдуманных чисел
        features: { ...ZERO_FEATURES },
      }
    })

    return {
      tMs: nowMs,
      hands: handFrames,
      // Pose (наклон корпусом) не подключён — решение по нему отдельным шагом
      player: { leanX: 0, duck: 0 },
      events: { shoot: false },
      diagnostics: buildDiagnostics(nowMs),
      metrics: {
        cameraFps: cameraFps.fps,
        detectFps: detectFps.fps,
        poseFps: null,
        latencyMs,
        brightness: lastBrightness,
      },
      // калибровка появится вместе с экраном CALIBRATE
      calibration: null,
    }
  }

  function buildDiagnostics(nowMs: number): Diagnostic[] {
    const list: Diagnostic[] = []

    if (hands.length === 0) {
      if (noHandSinceMs === null) noHandSinceMs = nowMs
      const missingMs = nowMs - noHandSinceMs
      if (missingMs > ENV.NO_HAND_MS) {
        list.push({
          code: 'NO_HAND',
          severity: 'block',
          message: 'Руки не видно — распознавание стоит',
          hint: 'Подними кисть в кадр целиком',
          metric: {
            name: 'noHandMs',
            value: missingMs,
            limit: ENV.NO_HAND_MS,
            comparator: 'gt',
            unit: 'ms',
          },
          highlight: { frame: true },
        })
      }
    } else {
      noHandSinceMs = null
    }

    // 0 означает «замера ещё не было» — иначе первый кадр зря ругался бы на темноту
    if (lastBrightness > 0 && lastBrightness < ENV.BRIGHTNESS_MIN) {
      list.push({
        code: 'TOO_DARK',
        severity: 'block',
        message: 'Слишком темно — распознавание работает хуже',
        hint: 'Включи лампу перед собой, а не за спиной',
        metric: {
          name: 'brightness',
          value: lastBrightness,
          limit: ENV.BRIGHTNESS_MIN,
          comparator: 'lt',
          unit: 'luma',
        },
        highlight: { dim: true },
      })
    }

    return list
  }

  function read(nowMs: number): FrameInput {
    const shoot = pendingShoot
    pendingShoot = false
    if (latestFrame === null) return emptyFrameInput(nowMs)
    if (!shoot) return latestFrame
    return { ...latestFrame, tMs: nowMs, events: { shoot: true } }
  }

  function dispose(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    window.removeEventListener('keydown', onKeyDown)
    camera?.stop()
    camera = null
    tracker?.close()
    tracker = null
    brightness.dispose()
    hands = []
    latestFrame = null
    aim = null
    noHandSinceMs = null
  }

  return {
    get video(): HTMLVideoElement {
      if (camera === null) throw new Error('Камера ещё не запущена: сначала start()')
      return camera.video
    },
    overlay,
    start,
    read,
    dispose,
  }
}

/**
 * Руку с указательным пальцем ставим первой: игровой движок читает прицел из `hands[0]`,
 * и без сортировки левая рука, случайно оказавшаяся в кадре, уводила бы прицел.
 */
function aimingHandFirst(hands: DetectedHand[]): DetectedHand[] {
  return [...hands].sort(
    (left, right) => Number(isPointing(right.landmarks)) - Number(isPointing(left.landmarks)),
  )
}

function primaryHighlight(diagnostics: readonly Diagnostic[]): Diagnostic['highlight'] {
  return primaryDiagnostic(diagnostics)?.highlight
}
