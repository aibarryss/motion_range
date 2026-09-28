/**
 * Признаки руки (SPEC §1) — то, на чём держится весь «режим ошибки».
 *
 * Каждая подсказка в игре называет измеренное значение и порог, а порог сравнивается
 * именно с признаком. Поэтому признаки считаются здесь один раз и в одном месте:
 * дальше по коду их никто не пересчитывает по-своему.
 *
 * Все пороги берутся из `src/shared/consts.ts` — числа в формулах не дублируются.
 *
 * ПРО ГЕОМЕТРИЮ (важно). MediaPipe нормирует координаты по осям отдельно: x делится на
 * ширину кадра, y — на высоту. Для кадра 640×480 это значит, что одинаковые по физической
 * длине отрезки по горизонтали и по вертикали дают разные числа, и углы сгиба пальцев
 * получались бы перекошенными. Поэтому точки переводятся в «единицы ширины кадра»:
 *   u = x,  v = y · (высота / ширина)
 * В этих единицах расстояния честные, углы правильные, а ширина ладони сразу получается
 * в долях кадра — это и есть `palmWidthRatio`, ничего дополнительно делить не нужно.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FINGER, OPENING, SCORES, ZERO_FEATURES } from '../shared/consts'
import type { Handedness, HandFeatures } from '../shared/types'
import { LM } from './aimGesture'

/** Размер кадра камеры в пикселях. */
export interface FrameSize {
  width: number
  height: number
}

export interface FeatureTracker {
  /**
   * Признаки одной руки на текущем кадре.
   * Меняет внутреннее состояние перехода кулак → ладонь (`openingSpeedMs`),
   * поэтому вызывать для каждой руки на каждом кадре.
   */
  compute(
    landmarks: readonly NormalizedLandmark[],
    size: FrameSize,
    nowMs: number,
    handedness: Handedness,
  ): HandFeatures
  reset(): void
}

/** Точка в единицах ширины кадра. */
interface P {
  u: number
  v: number
  z: number
}

const FINGERS: ReadonlyArray<{ mcp: number; pip: number; dip: number; tip: number }> = [
  { mcp: LM.INDEX_MCP, pip: LM.INDEX_PIP, dip: LM.INDEX_DIP, tip: LM.INDEX_TIP },
  { mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
  { mcp: LM.RING_MCP, pip: LM.RING_PIP, dip: LM.RING_DIP, tip: LM.RING_TIP },
  { mcp: LM.PINKY_MCP, pip: LM.PINKY_PIP, dip: LM.PINKY_DIP, tip: LM.PINKY_TIP },
]

export function createFeatureTracker(): FeatureTracker {
  /** Когда кулак был подтверждён в последний раз — для длительности раскрытия. */
  const lastFistMs = new Map<Handedness, number>()

  function compute(
    landmarks: readonly NormalizedLandmark[],
    size: FrameSize,
    nowMs: number,
    handedness: Handedness,
  ): HandFeatures {
    const points = toFrameUnits(landmarks, size)
    if (points === null) return { ...ZERO_FEATURES }

    const wrist = points[LM.WRIST]
    const middleMcp = points[LM.MIDDLE_MCP]
    const thumbTip = points[LM.THUMB_TIP]
    const indexMcp = points[LM.INDEX_MCP]
    const pinkyMcp = points[LM.PINKY_MCP]
    if (
      wrist === undefined ||
      middleMcp === undefined ||
      thumbTip === undefined ||
      indexMcp === undefined ||
      pinkyMcp === undefined
    ) {
      return { ...ZERO_FEATURES }
    }

    // W — ширина ладони, базовая единица нормировки (SPEC §1). В единицах ширины кадра
    // она же равна palmWidthRatio: доля кадра, которую занимает ладонь.
    const palmWidth = distance2(indexMcp, pinkyMcp)
    if (palmWidth <= 0) return { ...ZERO_FEATURES }

    const palmCenter: P = {
      u: (wrist.u + middleMcp.u) / 2,
      v: (wrist.v + middleMcp.v) / 2,
      z: (wrist.z + middleMcp.z) / 2,
    }

    const curls: number[] = []
    const curled: number[] = []
    const opened: number[] = []
    const tipsNearPalm: number[] = []
    const tipsFarFromWrist: number[] = []

    for (const finger of FINGERS) {
      const mcp = points[finger.mcp]
      const pip = points[finger.pip]
      const dip = points[finger.dip]
      const tip = points[finger.tip]
      if (mcp === undefined || pip === undefined || dip === undefined || tip === undefined) {
        return { ...ZERO_FEATURES }
      }

      const angle = angleAtDeg(pip, mcp, dip)
      curls.push(angle)
      curled.push(curlScore(angle))
      opened.push(openScore(angle))
      tipsNearPalm.push(distance2(tip, palmCenter) < FINGER.TIP_TO_PALM * palmWidth ? 1 : 0)
      tipsFarFromWrist.push(distance2(wrist, tip) > FINGER.WRIST_TIP * palmWidth ? 1 : 0)
    }

    // Кулак: доля согнутых пальцев, помноженная на долю кончиков, реально прижатых к ладони.
    // Без второго множителя «сжатые, но растопыренные» пальцы считались бы кулаком,
    // хотя игрок такой жест не показывал.
    const fistScore = mean(curled) * mean(tipsNearPalm)
    const openPalmScore = mean(opened) * mean(tipsFarFromWrist)

    const thumbExtension = distance2(thumbTip, indexMcp) / palmWidth
    const palmFrontality = palmFrontalityOf(indexMcp, pinkyMcp)
    const palmRollDeg = palmRollOf(indexMcp, pinkyMcp)

    return {
      fistScore,
      openPalmScore,
      thumbExtension,
      palmFrontality,
      palmWidthRatio: palmWidth,
      palmRollDeg,
      openingSpeedMs: measureOpening(lastFistMs, fistScore, openPalmScore, nowMs, handedness),
      fingerCurlDeg: [curls[0] ?? 0, curls[1] ?? 0, curls[2] ?? 0, curls[3] ?? 0],
    }
  }

  return {
    compute,
    reset(): void {
      lastFistMs.clear()
    },
  }
}

/**
 * Длительность текущего перехода кулак → ладонь, мс; null — перехода нет.
 *
 * Смысл для игры: раскрытие дольше `OPENING.WINDOW_MS` — это плавное движение, а не
 * переход, и оно не считается одним жестом. Здесь только измерение: решают потребители
 * (индикатор «Motion speed» в Signal Doctor, SPEC §5).
 */
function measureOpening(
  lastFistMs: Map<Handedness, number>,
  fistScore: number,
  openPalmScore: number,
  nowMs: number,
  handedness: Handedness,
): number | null {
  if (fistScore > SCORES.ENTER) {
    lastFistMs.set(handedness, nowMs)
    return null
  }

  const fistAt = lastFistMs.get(handedness)
  if (fistAt === undefined) return null
  if (openPalmScore <= SCORES.ENTER) return null

  lastFistMs.delete(handedness)
  const durationMs = nowMs - fistAt
  return durationMs <= OPENING.WINDOW_MS ? durationMs : null
}

function toFrameUnits(landmarks: readonly NormalizedLandmark[], size: FrameSize): P[] | null {
  if (landmarks.length < 21) return null
  if (size.width <= 0 || size.height <= 0) return null

  const scaleY = size.height / size.width
  const points: P[] = []
  for (const landmark of landmarks) {
    points.push({ u: landmark.x, v: landmark.y * scaleY, z: landmark.z })
  }
  return points
}

function distance2(a: P, b: P): number {
  return Math.hypot(a.u - b.u, a.v - b.v)
}

function distance3(a: P, b: P): number {
  return Math.sqrt((a.u - b.u) ** 2 + (a.v - b.v) ** 2 + (a.z - b.z) ** 2)
}

/** Угол при точке `at` между лучами на `a` и на `b`, в градусах: 180° — прямая линия. */
function angleAtDeg(at: P, a: P, b: P): number {
  const v1 = { u: a.u - at.u, v: a.v - at.v }
  const v2 = { u: b.u - at.u, v: b.v - at.v }
  const len1 = Math.hypot(v1.u, v1.v)
  const len2 = Math.hypot(v2.u, v2.v)
  if (len1 === 0 || len2 === 0) return 0
  const cos = clamp((v1.u * v2.u + v1.v * v2.v) / (len1 * len2), -1, 1)
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Насколько палец согнут, 0..1. Между порогами SPEC §1 («согнут <150°», «разогнут >165°»)
 * интерполируем линейно: так у жеста нет мёртвой зоны, и порог входа автомата 0.8
 * достигается предсказуемо, а не скачком.
 */
function curlScore(angleDeg: number): number {
  const span = FINGER.STRAIGHT_MIN_DEG - FINGER.CURLED_MAX_DEG
  return clamp((FINGER.STRAIGHT_MIN_DEG - angleDeg) / span, 0, 1)
}

/** Насколько палец разогнут, 0..1 — обратная к `curlScore` по тем же порогам. */
function openScore(angleDeg: number): number {
  const span = FINGER.STRAIGHT_MIN_DEG - FINGER.CURLED_MAX_DEG
  return clamp((angleDeg - FINGER.CURLED_MAX_DEG) / span, 0, 1)
}

/**
 * palmFrontality = W_2d / W_3d (SPEC §1).
 * Ладонь смотрит в камеру — проекция почти не сжимается, отношение близко к 1.
 * Ладонь повёрнута ребром — 2D-ширина резко падает, отношение уходит ниже порога щита.
 */
function palmFrontalityOf(indexMcp: P, pinkyMcp: P): number {
  const width3d = distance3(indexMcp, pinkyMcp)
  if (width3d <= 0) return 0
  return clamp(distance2(indexMcp, pinkyMcp) / width3d, 0, 1)
}

/**
 * palmRoll — наклон линии ладони 5→17 относительно горизонта, в градусах.
 *
 * Приводим к 0..90: наклон влево и вправо для игрока одинаково «завален», а порог
 * `PALM.ROLL_MAX_DEG` не должен зависеть от того, какой рукой играют.
 */
function palmRollOf(indexMcp: P, pinkyMcp: P): number {
  const du = pinkyMcp.u - indexMcp.u
  const dv = pinkyMcp.v - indexMcp.v
  if (du === 0 && dv === 0) return 0
  const deg = Math.abs((Math.atan2(dv, du) * 180) / Math.PI)
  return deg > 90 ? 180 - deg : deg
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
