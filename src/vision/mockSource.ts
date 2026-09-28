/**
 * ВРЕМЕННЫЙ мок `FrameInput`: мышь вместо руки, клавиши вместо жестов.
 *
 * Зачем: каркас игры (экраны, цикл, HUD, диагностика) собирается и проверяется до того,
 * как появится распознавание. Мок отдаёт тот же замороженный контракт, поэтому замена
 * на реальный vision — это замена одной строки в `src/ui/app.ts`, а не переделка игры.
 *
 * Что мок изображает:
 *   мышь          → рука и прицел; без движения дольше `ENV.NO_HAND_MS` → диагностика NO_HAND
 *   Space / клик  → выстрел импульсом `events.shoot` (он же скрытый fallback из SPEC §2)
 *   F (держать)   → кулак (`HandFrame.gesture = FIST`), HUD покажет ARMED
 *   S (держать)   → щит (`Gesture.SHIELD`)
 *   L (держать)   → темно: brightness ниже порога → TOO_DARK
 *   C (держать)   → низкая уверенность → LOW_CONFIDENCE
 *
 * Чего мок НЕ делает: не считает настоящие признаки руки. `features` заполняются
 * правдоподобными числами, чтобы UI и реплей-харнесс было на чём проверить.
 * А вот диагностики он собирает настоящими `MetricReading` — значит UI проверяется
 * на реальном формате чисел, а не на выдуманных строках.
 */

import { ENV, PALM, THUMB, ZERO_FEATURES } from '../shared/consts'
import type { Diagnostic, FrameInput, Gesture, HandFrame, HandFeatures } from '../shared/types'

export interface MockSource {
  /** Кадр на момент nowMs. Структурно совпадает с `FrameInputReader` из game/engine. */
  read(nowMs: number): FrameInput
  /** Снять слушатели мыши и клавиатуры. */
  dispose(): void
}

export function createKeyboardMockSource(): MockSource {
  const pressed = new Set<string>()
  let aim = { x: 0.5, y: 0.45 }
  let lastPointerMoveMs = performance.now()
  let shootQueued = false
  let framesInWindow = 0
  let windowStartMs = performance.now()
  let cameraFps = 60

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase()
    if (key === ' ' || key === 'spacebar') {
      shootQueued = true
      event.preventDefault()
      return
    }
    pressed.add(key)
  }

  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.key.toLowerCase())
  }

  const onPointerMove = (event: PointerEvent): void => {
    aim = {
      x: clamp01(event.clientX / window.innerWidth),
      y: clamp01(event.clientY / window.innerHeight),
    }
    lastPointerMoveMs = performance.now()
  }

  const onPointerDown = (): void => {
    shootQueued = true
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerdown', onPointerDown)

  function dispose(): void {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerdown', onPointerDown)
    pressed.clear()
  }

  function read(nowMs: number): FrameInput {
    framesInWindow += 1
    const windowMs = nowMs - windowStartMs
    if (windowMs >= 500) {
      cameraFps = (framesInWindow * 1000) / windowMs
      framesInWindow = 0
      windowStartMs = nowMs
    }

    const dark = pressed.has('l')
    const unsure = pressed.has('c')
    const brightness = dark ? Math.round(ENV.BRIGHTNESS_MIN - 20) : 140
    const confidence = unsure ? 0.32 : 0.94
    const noHandMs = Math.max(0, nowMs - lastPointerMoveMs)
    const handVisible = noHandMs < ENV.NO_HAND_MS

    let gesture: Gesture = 'NONE'
    if (handVisible) {
      if (pressed.has('f')) gesture = 'FIST'
      else if (pressed.has('s')) gesture = 'SHIELD'
      else gesture = 'AIM'
    }

    const shoot = shootQueued
    shootQueued = false

    const hands: HandFrame[] = handVisible
      ? [
          {
            gesture,
            handedness: 'R',
            x: aim.x,
            y: aim.y,
            confidence,
            features: featuresFor(gesture),
          },
        ]
      : []

    return {
      tMs: nowMs,
      hands,
      player: { leanX: 0, duck: 0 },
      events: { shoot },
      diagnostics: diagnosticsFor(handVisible, noHandMs, brightness, confidence),
      metrics: {
        cameraFps,
        detectFps: Math.min(cameraFps, 30),
        poseFps: null,
        latencyMs: 40 + Math.round(Math.random() * 50),
        brightness,
      },
      calibration: null,
    }
  }

  return { read, dispose }
}

/**
 * Диагностики мока. Порядок как в SPEC §3: при равной severity UI покажет первую,
 * поэтому «руки не видно» идёт раньше «темно».
 */
function diagnosticsFor(
  handVisible: boolean,
  noHandMs: number,
  brightness: number,
  confidence: number,
): Diagnostic[] {
  const list: Diagnostic[] = []

  if (!handVisible) {
    list.push({
      code: 'NO_HAND',
      severity: 'block',
      message: 'Руки не видно — распознавание стоит',
      hint: 'Подними кисть в кадр',
      metric: {
        name: 'noHandMs',
        value: noHandMs,
        limit: ENV.NO_HAND_MS,
        comparator: 'gt',
        unit: 'ms',
      },
      highlight: { frame: true },
    })
  }

  if (brightness < ENV.BRIGHTNESS_MIN) {
    list.push({
      code: 'TOO_DARK',
      severity: 'block',
      message: 'Слишком темно — распознавание не работает',
      hint: 'Включи лампу перед собой',
      metric: {
        name: 'brightness',
        value: brightness,
        limit: ENV.BRIGHTNESS_MIN,
        comparator: 'lt',
        unit: 'luma',
      },
      highlight: { dim: true },
    })
  }

  if (handVisible && confidence < ENV.CONFIDENCE_MIN) {
    list.push({
      code: 'LOW_CONFIDENCE',
      severity: 'block',
      message: 'Камера не уверена в руке',
      hint: 'Убери кисть от корпуса — тёмный фон помогает',
      metric: {
        name: 'handConfidence',
        value: confidence,
        limit: ENV.CONFIDENCE_MIN,
        comparator: 'lt',
        unit: 'ratio',
      },
      highlight: { points: ALL_POINTS },
    })
  }

  return list
}

function featuresFor(gesture: Gesture): HandFeatures {
  const base: HandFeatures = {
    ...ZERO_FEATURES,
    palmWidthRatio: 0.21,
    palmFrontality: PALM.FRONT + 0.04,
    palmRollDeg: 8,
  }

  switch (gesture) {
    case 'FIST':
      return { ...base, fistScore: 0.95, openPalmScore: 0.05, thumbExtension: THUMB.TARGET_MAX_FIST - 0.04 }
    case 'SHIELD':
      // щит — это palmFrontality выше порога PALM.FRONT (SPEC §1)
      return { ...base, fistScore: 0.1, openPalmScore: 0.95, palmFrontality: PALM.FRONT + 0.16, thumbExtension: 0.5 }
    case 'AIM':
      return { ...base, fistScore: 0.25, openPalmScore: 0.5, thumbExtension: 0.35 }
    case 'NONE':
      return { ...ZERO_FEATURES }
  }
}

const ALL_POINTS: number[] = Array.from({ length: 21 }, (_, index) => index)

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
