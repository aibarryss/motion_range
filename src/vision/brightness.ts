/**
 * Яркость кадра (0..255) — метрика `FrameMetrics.brightness` из контракта
 * и источник диагностики TOO_DARK (SPEC §3).
 *
 * Считаем среднюю luma на уменьшенной копии кадра: для порога «мало света» этого
 * достаточно, а по времени операция почти бесплатная. Область — рамка руки, если рука
 * найдена, иначе весь кадр (SPEC §1).
 */

import type { DetectedHand } from './handTracker'

const SAMPLE_WIDTH = 32
const SAMPLE_HEIGHT = 24

/** Прямоугольник в нормированных координатах кадра (0..1). */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface BrightnessSampler {
  sample(video: HTMLVideoElement, box: Box | null): number
  dispose(): void
}

/** Рамка вокруг всех найденных рук; null — рук нет. */
export function handBox(hands: readonly DetectedHand[]): Box | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const hand of hands) {
    for (const landmark of hand.landmarks) {
      minX = Math.min(minX, landmark.x)
      minY = Math.min(minY, landmark.y)
      maxX = Math.max(maxX, landmark.x)
      maxY = Math.max(maxY, landmark.y)
    }
  }

  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function createBrightnessSampler(): BrightnessSampler {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null

  function ensureContext(): CanvasRenderingContext2D | null {
    if (ctx !== null) return ctx
    canvas = document.createElement('canvas')
    canvas.width = SAMPLE_WIDTH
    canvas.height = SAMPLE_HEIGHT
    ctx = canvas.getContext('2d', { willReadFrequently: true })
    return ctx
  }

  return {
    sample(video: HTMLVideoElement, box: Box | null): number {
      const context = ensureContext()
      if (context === null) return 0

      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight
      if (videoWidth === 0 || videoHeight === 0) return 0

      // рамка руки в пикселях кадра; если руки нет — берём весь кадр
      const sx = box === null ? 0 : Math.max(0, Math.floor(box.x * videoWidth) - 8)
      const sy = box === null ? 0 : Math.max(0, Math.floor(box.y * videoHeight) - 8)
      const sw = box === null ? videoWidth : Math.min(videoWidth - sx, Math.ceil(box.width * videoWidth) + 16)
      const sh = box === null ? videoHeight : Math.min(videoHeight - sy, Math.ceil(box.height * videoHeight) + 16)
      if (sw <= 0 || sh <= 0) return 0

      try {
        context.drawImage(video, sx, sy, sw, sh, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
        const data = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data
        let sum = 0
        const pixels = SAMPLE_WIDTH * SAMPLE_HEIGHT
        for (let index = 0; index < data.length; index += 4) {
          // luma по Rec.601 — так же считают яркость кадра в видео
          sum += 0.299 * (data[index] ?? 0) + 0.587 * (data[index + 1] ?? 0) + 0.114 * (data[index + 2] ?? 0)
        }
        return Math.round(sum / pixels)
      } catch {
        // кадр мог не успеть появиться — вернём «нет данных», а не сломаем цикл
        return 0
      }
    },
    dispose(): void {
      canvas = null
      ctx = null
    },
  }
}
