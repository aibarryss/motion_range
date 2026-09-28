/**
 * Тесты прицела: «показываю пальцем», координата прицела, сглаживание,
 * рамка руки и счётчик кадров.
 *
 * Это чистая математика — камеру и браузер проверять не нужно. Синтетическая рука
 * строится так, что расстояния точек от запястья известны заранее, поэтому правило
 * проверяется точно, а не «на глазок по видео».
 */

import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { aimPointOf, isPointing, palmWidth, smoothAim } from '../src/vision/aimGesture'
import { handBox } from '../src/vision/brightness'
import { createFpsMeter } from '../src/vision/fps'
import type { DetectedHand } from '../src/vision/handTracker'

function landmark(x: number, y: number): NormalizedLandmark {
  return { x, y, z: 0, visibility: 1 }
}

const WRIST = landmark(0.5, 0.9)

/** Смещения точек пальца вверх от запястья: MCP, PIP, DIP, TIP. */
type FingerShape = readonly [number, number, number, number]

/** Кончик дальше от запястья, чем средний сустав → палец вытянут. */
const EXTENDED: FingerShape = [0.06, 0.1, 0.14, 0.18]
/** Кончик ближе к запястью, чем средний сустав → палец согнут. */
const CURLED: FingerShape = [0.06, 0.1, 0.08, 0.07]

function fingerPoints(shape: FingerShape): NormalizedLandmark[] {
  return shape.map((offset) => landmark(0.5, WRIST.y - offset))
}

function buildHand(shapes: {
  index: FingerShape
  middle: FingerShape
  ring: FingerShape
  pinky: FingerShape
}): NormalizedLandmark[] {
  const points: NormalizedLandmark[] = []
  points[0] = WRIST
  points[1] = landmark(0.44, 0.86)
  points[2] = landmark(0.42, 0.83)
  points[3] = landmark(0.4, 0.8)
  points[4] = landmark(0.39, 0.78)
  points.push(...fingerPoints(shapes.index)) // 5..8
  points.push(...fingerPoints(shapes.middle)) // 9..12
  points.push(...fingerPoints(shapes.ring)) // 13..16
  points.push(...fingerPoints(shapes.pinky)) // 17..20
  return points
}

const POINTING = buildHand({ index: EXTENDED, middle: CURLED, ring: CURLED, pinky: CURLED })
const FIST = buildHand({ index: CURLED, middle: CURLED, ring: CURLED, pinky: CURLED })
const OPEN_PALM = buildHand({ index: EXTENDED, middle: EXTENDED, ring: EXTENDED, pinky: EXTENDED })

function detected(landmarks: NormalizedLandmark[]): DetectedHand {
  return { landmarks, handedness: 'R', score: 0.95 }
}

describe('прицел: показываю пальцем', () => {
  it('указательный вытянут, остальные поджаты → прицел есть', () => {
    expect(isPointing(POINTING)).toBe(true)
  })

  it('кулак → прицела нет', () => {
    expect(isPointing(FIST)).toBe(false)
  })

  it('раскрытая ладонь → прицела нет (это будущий щит, а не указание)', () => {
    expect(isPointing(OPEN_PALM)).toBe(false)
  })

  it('неполная рука (меньше 21 точки) → прицела нет, а не падение', () => {
    expect(isPointing(POINTING.slice(0, 10))).toBe(false)
  })

  it('координата прицела зеркальная: палец слева в кадре — слева и на экране', () => {
    const hand = POINTING.map((point) => ({ ...point }))
    hand[8] = landmark(0.3, 0.42)

    const aim = aimPointOf(hand)
    expect(aim).not.toBeNull()
    // 1 − 0.3: камера смотрит на человека, показ зеркальный
    expect(aim?.x).toBeCloseTo(0.7, 5)
    expect(aim?.y).toBeCloseTo(0.42, 5)
  })

  it('сглаживание: первый кадр берётся целиком, дальше — доля от разницы', () => {
    const first = smoothAim(null, { x: 0.2, y: 0.2 }, 0.35)
    expect(first).toEqual({ x: 0.2, y: 0.2 })

    const second = smoothAim(first, { x: 1, y: 0.2 }, 0.35)
    expect(second.x).toBeCloseTo(0.2 + 0.35 * 0.8, 5)
    expect(second.y).toBeCloseTo(0.2, 5)
  })

  it('ширина ладони — расстояние между точками 5 и 17 (единица нормировки)', () => {
    const hand = buildHand({ index: EXTENDED, middle: CURLED, ring: CURLED, pinky: CURLED })
    hand[5] = landmark(0.4, 0.8)
    hand[17] = landmark(0.6, 0.8)
    expect(palmWidth(hand)).toBeCloseTo(0.2, 5)
  })
})

describe('рамка руки для замера яркости', () => {
  it('охватывает все точки найденных рук', () => {
    const box = handBox([detected(POINTING)])
    expect(box).not.toBeNull()
    expect(box?.x).toBeCloseTo(0.39, 5)
    expect(box?.y).toBeCloseTo(WRIST.y - 0.18, 5)
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)
  })

  it('рук нет — рамки нет', () => {
    expect(handBox([])).toBeNull()
  })
})

describe('счётчик кадров', () => {
  it('на равномерных 10 кадрах в секунду показывает 10', () => {
    const meter = createFpsMeter(500)
    for (let index = 0; index <= 20; index += 1) meter.tick(index * 100)
    // Окно закрывается на кадре-границе, поэтому первое значение может быть выше на один
    // кадр (12 вместо 10) — это цена счётчика в пять строк. Устойчивое значение точное.
    expect(meter.fps).toBeCloseTo(10, 5)
  })

  it('до закрытия окна значение остаётся прежним', () => {
    const meter = createFpsMeter(500)
    meter.tick(0)
    meter.tick(100)
    expect(meter.fps).toBe(0)
  })
})
