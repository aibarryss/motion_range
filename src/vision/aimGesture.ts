/**
 * Прицел: какие точки руки считать «пальцем-указателем» и куда он показывает.
 *
 * ВАЖНО ПРО ГРАНИЦЫ ШАГА. Полный набор признаков из SPEC §1 — углы сгиба пальцев,
 * `fistScore`, `openPalmScore`, `thumbExtension`, `palmFrontality`, `palmWidthRatio`,
 * `palmRoll` — это следующая задача. Здесь только минимум, без которого прицел не поедет:
 * «указательный вытянут, остальные поджаты» и координата кончика указательного пальца.
 *
 * Проверка вытянутости сделана без порогов: палец вытянут, если его кончик дальше от
 * запястья, чем средний сустав того же пальца. Это устойчиво к расстоянию до камеры и
 * не требует подбора чисел. Когда появятся признаки, правило заменится на пороги
 * `FINGER.*` из `src/shared/consts.ts`.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/** Индексы точек MediaPipe — чтобы дальше по коду не было чисел без имени. */
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const

export interface Point2 {
  x: number
  y: number
}

function point(landmarks: readonly NormalizedLandmark[], index: number): NormalizedLandmark | null {
  const found = landmarks[index]
  return found === undefined ? null : found
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Ширина ладони W = |lm5 − lm17| — базовая единица нормировки проекта (SPEC §1).
 * Здесь она пока нужна только как мера размера руки; пороги в единицах W — впереди.
 */
export function palmWidth(landmarks: readonly NormalizedLandmark[]): number {
  const mcp = point(landmarks, LM.INDEX_MCP)
  const pinky = point(landmarks, LM.PINKY_MCP)
  if (mcp === null || pinky === null) return 0
  return distance(mcp, pinky)
}

/** Палец вытянут: кончик дальше от запястья, чем средний сустав. */
function isFingerExtended(
  landmarks: readonly NormalizedLandmark[],
  tipIndex: number,
  pipIndex: number,
): boolean {
  const wrist = point(landmarks, LM.WRIST)
  const tip = point(landmarks, tipIndex)
  const pip = point(landmarks, pipIndex)
  if (wrist === null || tip === null || pip === null) return false
  return distance(wrist, tip) > distance(wrist, pip)
}

/** Указательный вытянут, а из остальных трёх поджаты минимум два — «показываю пальцем». */
export function isPointing(landmarks: readonly NormalizedLandmark[]): boolean {
  if (landmarks.length < 21) return false
  const indexExtended = isFingerExtended(landmarks, LM.INDEX_TIP, LM.INDEX_PIP)
  if (!indexExtended) return false

  const others = [
    isFingerExtended(landmarks, LM.MIDDLE_TIP, LM.MIDDLE_PIP),
    isFingerExtended(landmarks, LM.RING_TIP, LM.RING_PIP),
    isFingerExtended(landmarks, LM.PINKY_TIP, LM.PINKY_PIP),
  ]
  return others.filter((extended) => !extended).length >= 2
}

/**
 * Куда показывает палец: кончик указательного, уже зеркальный.
 *
 * Зеркальность важна: камеру на экране показываем зеркалом (человек ждёт, что поднятая
 * правая рука уедет вправо), поэтому горизонталь разворачиваем прямо здесь — и в
 * контракте `HandFrame.x` уже экранная координата, как записано в `types.ts`.
 */
export function aimPointOf(landmarks: readonly NormalizedLandmark[]): Point2 | null {
  const tip = point(landmarks, LM.INDEX_TIP)
  if (tip === null) return null
  return { x: 1 - tip.x, y: tip.y }
}

/** Плавное сглаживание прицела (SPEC §2 требует EMA): вес нового значения — `SMOOTH.AIM_EMA`. */
export function smoothAim(previous: Point2 | null, next: Point2, factor: number): Point2 {
  if (previous === null) return next
  return {
    x: previous.x + factor * (next.x - previous.x),
    y: previous.y + factor * (next.y - previous.y),
  }
}
