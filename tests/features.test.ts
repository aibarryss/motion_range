/**
 * Тесты признаков руки (SPEC §1).
 *
 * Рука строится синтетическая, но по-честному: угол в среднем суставе каждого пальца
 * задаётся заранее, поэтому ожидаемые значения признаков вычисляются точно. Браузер и
 * камера не нужны — здесь только геометрия.
 *
 * Отдельно проверяется поправка на пропорции кадра: у MediaPipe x и y нормированы по
 * осям отдельно, и для кадра 640×480 диагональ ладони в «сырых» координатах перекошена.
 */

import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FINGER, FIRE, SCORES } from '../src/shared/consts'
import { LM } from '../src/vision/aimGesture'
import { createFeatureTracker, type FrameSize } from '../src/vision/features'

const SQUARE: FrameSize = { width: 1000, height: 1000 }
const CAMERA: FrameSize = { width: 640, height: 480 }

/** Положения оснований пальцев: W = |lm5 − lm17| = 0.18 кадра, как у ладони в кадре. */
const MCP_LIST: ReadonlyArray<readonly [number, number]> = [
  [0.42, 0.6],
  [0.48, 0.58],
  [0.54, 0.58],
  [0.6, 0.6],
]
const FINGER_STARTS = [LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP]

const WRIST: readonly [number, number] = [0.5, 0.75]
const MIDDLE_MCP = MCP_LIST[1] as readonly [number, number]
/** Середина ладони — то, к чему прижимаются кончики в кулаке. */
const PALM_CENTER: readonly [number, number] = [
  (WRIST[0] + MIDDLE_MCP[0]) / 2,
  (WRIST[1] + MIDDLE_MCP[1]) / 2,
]

function lm(x: number, y: number, z = 0): NormalizedLandmark {
  return { x, y, z, visibility: 1 }
}

/** Направление в градусах для `direction()`: 0° — вверх, 90° — вправо, 180° — вниз. */
function directionDeg(from: readonly [number, number], to: readonly [number, number]): number {
  return (Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI
}

function direction(deg: number): { du: number; dv: number } {
  const rad = (deg * Math.PI) / 180
  return { du: Math.sin(rad), dv: -Math.cos(rad) }
}

interface FingerSpec {
  mcp: readonly [number, number]
  /** Направление самого пальца: 0° — вверх. */
  leanDeg?: number
  /** На сколько градусов палец отогнут от прямой: 0 — прямой, 160 — почти полностью сжат. */
  bendDeg: number
}

/**
 * Четыре точки пальца. Угол при среднем суставе получается ровно `180° − bendDeg`,
 * поэтому ожидаемые значения признаков известны заранее.
 */
function fingerPoints(spec: FingerSpec, segment: number): NormalizedLandmark[] {
  const lean = spec.leanDeg ?? 0
  const start = direction(lean)
  const pip = { x: spec.mcp[0] + segment * start.du, y: spec.mcp[1] + segment * start.dv }
  const first = direction(lean + spec.bendDeg)
  const dip = { x: pip.x + segment * first.du, y: pip.y + segment * first.dv }
  const second = direction(lean + 2 * spec.bendDeg)
  const tip = { x: dip.x + segment * second.du, y: dip.y + segment * second.dv }
  return [lm(...spec.mcp), lm(pip.x, pip.y), lm(dip.x, dip.y), lm(tip.x, tip.y)]
}

function buildHand(
  fingers: readonly [FingerSpec, FingerSpec, FingerSpec, FingerSpec],
  options: { segment?: number; thumbTip?: readonly [number, number] } = {},
): NormalizedLandmark[] {
  const segment = options.segment ?? 0.057
  const thumbTip = options.thumbTip ?? [0.36, 0.62]

  const points: NormalizedLandmark[] = []
  points[LM.WRIST] = lm(WRIST[0], WRIST[1])
  points[1] = lm(0.46, 0.68)
  points[2] = lm(0.43, 0.66)
  points[3] = lm(0.4, 0.64)
  points[LM.THUMB_TIP] = lm(thumbTip[0], thumbTip[1])

  fingers.forEach((spec, index) => {
    const start = FINGER_STARTS[index] ?? 0
    const parts = fingerPoints(spec, segment)
    for (let offset = 0; offset < 4; offset += 1) {
      points[start + offset] = parts[offset] ?? lm(0, 0)
    }
  })
  return points
}

/** Раскрытая ладонь: все пальцы прямые. */
function openPalm(): NormalizedLandmark[] {
  return buildHand(MCP_LIST.map((mcp) => ({ mcp, bendDeg: 0 })) as [
    FingerSpec,
    FingerSpec,
    FingerSpec,
    FingerSpec,
  ])
}

/** Кулак: пальцы складываются в сторону середины ладони, кончики ложатся на ладонь. */
function fist(): NormalizedLandmark[] {
  return buildHand(
    MCP_LIST.map((mcp) => ({
      mcp,
      leanDeg: directionDeg(mcp, PALM_CENTER),
      bendDeg: 160,
    })) as [FingerSpec, FingerSpec, FingerSpec, FingerSpec],
  )
}

describe('признаки руки: кулак и ладонь', () => {
  it('раскрытая ладонь: openPalmScore 1, fistScore 0', () => {
    const features = createFeatureTracker().compute(openPalm(), SQUARE, 0, 'R')
    expect(features.openPalmScore).toBeCloseTo(1, 3)
    expect(features.fistScore).toBeCloseTo(0, 3)
    expect(features.fingerCurlDeg[0]).toBeCloseTo(FINGER.STRAIGHT_MIN_DEG + 15, 1)
  })

  it('кулак: fistScore выше порога входа, openPalmScore 0', () => {
    const features = createFeatureTracker().compute(fist(), SQUARE, 0, 'R')
    expect(features.fistScore).toBeGreaterThan(SCORES.ENTER)
    expect(features.openPalmScore).toBeCloseTo(0, 3)
  })

  it('пальцы сжаты, но кончики далеко от ладони — это не кулак по порогу входа', () => {
    // те же сгибы, но палец смотрит вверх и кончик не ложится на ладонь
    const cage = buildHand(
      MCP_LIST.map((mcp) => ({ mcp, bendDeg: 160 })) as [FingerSpec, FingerSpec, FingerSpec, FingerSpec],
      { segment: 0.1 },
    )
    const features = createFeatureTracker().compute(cage, SQUARE, 0, 'R')
    expect(features.fistScore).toBeLessThan(SCORES.ENTER)
  })

  it('углы сгиба: 180° у прямого пальца, меньше 150° у сжатого', () => {
    const straight = createFeatureTracker().compute(openPalm(), SQUARE, 0, 'R')
    const curled = createFeatureTracker().compute(fist(), SQUARE, 0, 'R')
    expect(Math.min(...straight.fingerCurlDeg)).toBeGreaterThan(FINGER.STRAIGHT_MIN_DEG)
    expect(Math.max(...curled.fingerCurlDeg)).toBeLessThan(FINGER.CURLED_MAX_DEG)
  })
})

describe('признаки руки: большой палец, разворот ладони, дистанция', () => {
  it('thumbExtension — расстояние от кончика большого пальца до точки 5 в единицах ширины ладони', () => {
    // W = 0.18; шаг до точки 5 делаем 0.036 → ожидаем ровно 0.2
    const hand = buildHand(
      MCP_LIST.map((mcp) => ({ mcp, bendDeg: 0 })) as [FingerSpec, FingerSpec, FingerSpec, FingerSpec],
      { thumbTip: [0.456, 0.6] },
    )
    const features = createFeatureTracker().compute(hand, SQUARE, 0, 'R')
    expect(features.thumbExtension).toBeCloseTo(0.2, 2)
  })

  it('palmWidthRatio — ширина ладони в долях кадра', () => {
    const features = createFeatureTracker().compute(openPalm(), SQUARE, 0, 'R')
    expect(features.palmWidthRatio).toBeCloseTo(0.18, 3)
  })

  it('palmFrontality 1, когда ладонь плоская к камере, и падает, когда часть уходит по глубине', () => {
    const flat = createFeatureTracker().compute(openPalm(), SQUARE, 0, 'R')
    expect(flat.palmFrontality).toBeCloseTo(1, 3)

    const tilted = openPalm()
    const pinkyMcp = tilted[LM.PINKY_MCP]
    if (pinkyMcp !== undefined) pinkyMcp.z = 0.15
    const rolled = createFeatureTracker().compute(tilted, SQUARE, 0, 'R')
    expect(rolled.palmFrontality).toBeLessThan(flat.palmFrontality)
    expect(rolled.palmFrontality).toBeCloseTo(0.18 / Math.hypot(0.18, 0.15), 3)
  })

  it('palmRoll — наклон линии ладони, приведённый к 0..90°', () => {
    const diagonal: readonly [FingerSpec, FingerSpec, FingerSpec, FingerSpec] = [
      { mcp: [0.5, 0.6], bendDeg: 0 },
      { mcp: [0.53, 0.63], bendDeg: 0 },
      { mcp: [0.56, 0.66], bendDeg: 0 },
      { mcp: [0.6, 0.7], bendDeg: 0 },
    ]
    const features = createFeatureTracker().compute(buildHand(diagonal), SQUARE, 0, 'R')
    expect(features.palmRollDeg).toBeCloseTo(45, 1)

    const mirrored = createFeatureTracker().compute(
      buildHand([
        { mcp: [0.6, 0.6], bendDeg: 0 },
        { mcp: [0.57, 0.63], bendDeg: 0 },
        { mcp: [0.54, 0.66], bendDeg: 0 },
        { mcp: [0.5, 0.7], bendDeg: 0 },
      ]),
      SQUARE,
      0,
      'R',
    )
    expect(mirrored.palmRollDeg).toBeCloseTo(45, 1)
  })

  it('диагональ ладони считается честно и на кадре 640×480, а не только на квадратном', () => {
    const diagonal: readonly [FingerSpec, FingerSpec, FingerSpec, FingerSpec] = [
      { mcp: [0.5, 0.6], bendDeg: 0 },
      { mcp: [0.53, 0.63], bendDeg: 0 },
      { mcp: [0.56, 0.66], bendDeg: 0 },
      { mcp: [0.6, 0.7], bendDeg: 0 },
    ]
    const features = createFeatureTracker().compute(buildHand(diagonal), CAMERA, 0, 'R')
    // по вертикали кадр короче: 0.1 × (480/640) = 0.075 → наклон 36.9°, а не 45°
    expect(features.palmRollDeg).toBeCloseTo((Math.atan2(0.075, 0.1) * 180) / Math.PI, 1)
    expect(features.palmWidthRatio).toBeCloseTo(Math.hypot(0.1, 0.075), 3)
  })
})

describe('признаки руки: длительность раскрытия', () => {
  it('кулак → ладонь в пределах окна даёт длительность перехода', () => {
    const tracker = createFeatureTracker()
    expect(tracker.compute(fist(), SQUARE, 1000, 'R').openingSpeedMs).toBeNull()
    expect(tracker.compute(openPalm(), SQUARE, 1300, 'R').openingSpeedMs).toBe(300)
  })

  it('один переход сообщается один раз', () => {
    const tracker = createFeatureTracker()
    tracker.compute(fist(), SQUARE, 1000, 'R')
    expect(tracker.compute(openPalm(), SQUARE, 1300, 'R').openingSpeedMs).toBe(300)
    expect(tracker.compute(openPalm(), SQUARE, 1310, 'R').openingSpeedMs).toBeNull()
  })

  it('раскрытие дольше окна — это прицеливание, а не выстрел', () => {
    const tracker = createFeatureTracker()
    tracker.compute(fist(), SQUARE, 1000, 'R')
    expect(tracker.compute(openPalm(), SQUARE, 1000 + FIRE.OPEN_WINDOW_MS + 100, 'R').openingSpeedMs).toBeNull()
  })

  it('у каждой руки своё состояние перехода', () => {
    const tracker = createFeatureTracker()
    tracker.compute(fist(), SQUARE, 1000, 'L')
    expect(tracker.compute(openPalm(), SQUARE, 1200, 'R').openingSpeedMs).toBeNull()
    expect(tracker.compute(openPalm(), SQUARE, 1200, 'L').openingSpeedMs).toBe(200)
  })
})

describe('признаки руки: плохие данные не ломают кадр', () => {
  it('неполная рука даёт нулевой снапшот', () => {
    const features = createFeatureTracker().compute(openPalm().slice(0, 10), SQUARE, 0, 'R')
    expect(features.fistScore).toBe(0)
    expect(features.openPalmScore).toBe(0)
    expect(features.fingerCurlDeg).toHaveLength(4)
  })

  it('нулевая ширина ладони не даёт деления на ноль', () => {
    const hand = openPalm()
    const index = hand[LM.INDEX_MCP]
    const pinky = hand[LM.PINKY_MCP]
    if (index !== undefined && pinky !== undefined) {
      pinky.x = index.x
      pinky.y = index.y
    }
    const features = createFeatureTracker().compute(hand, SQUARE, 0, 'R')
    expect(features.palmWidthRatio).toBe(0)
    expect(Number.isFinite(features.thumbExtension)).toBe(true)
  })

  it('размер кадра 0 не даёт деления на ноль', () => {
    const features = createFeatureTracker().compute(openPalm(), { width: 0, height: 0 }, 0, 'R')
    expect(features.fistScore).toBe(0)
  })
})
