/**
 * Отрисовка поверх видео: кадр камеры + скелет руки (21 точка и связи).
 *
 * ПОЧЕМУ КАДР РИСУЕТСЯ ЗДЕСЬ ЖЕ, А НЕ ВИДЕО-ЭЛЕМЕНТОМ В DOM.
 * Раньше видео показывал `<video>`, а скелет — отдельный холст. Два независимых слоя
 * легко расходятся: у видео свои `object-fit`/зеркалирование, у холста свои. Хуже того,
 * видео на экране всегда свежее того кадра, по которому посчитаны точки, поэтому при
 * медленной камере (7–8 кадров в секунду в тёмной комнате) скелет «отстаёт» от руки.
 *
 * Теперь и картинка, и точки берутся из одного и того же снимка кадра — они не могут
 * разойтись по определению. Vision передаёт сюда тот самый холст-снимок, по которому
 * считала точки.
 */

import { fitCanvas } from '../ui/canvas'
import type { Highlight } from '../shared/types'
import { HAND_CONNECTIONS, type DetectedHand } from './handTracker'

export interface OverlayOptions {
  /** Кадр показываем зеркалом, значит и скелет зеркалим — иначе точки «отклеятся» от руки. */
  mirrored: boolean
  /** Что подсветить из текущей диагностики (SPEC §3, точка 2 ответа). */
  highlight?: Highlight
}

const BONE_COLOR = 'rgba(120, 230, 190, 0.9)'
const JOINT_COLOR = 'rgba(255, 255, 255, 0.95)'
const ALERT_COLOR = '#ff6b6b'

export function drawOverlay(
  canvas: HTMLCanvasElement,
  frame: CanvasImageSource | null,
  hands: readonly DetectedHand[],
  options: OverlayOptions,
): void {
  const fitted = fitCanvas(canvas)
  if (fitted === null) return
  const { ctx, width, height } = fitted

  ctx.clearRect(0, 0, width, height)

  if (frame !== null) {
    // кадр камеры растягивается ровно по рамке сцены: пропорции рамки равны пропорциям
    // кадра, поэтому искажения нет, а зеркало делаем здесь же — одним преобразованием
    ctx.save()
    if (options.mirrored) {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(frame, 0, 0, width, height)
    ctx.restore()
  }

  // TOO_DARK: затемняем оверлей (SPEC §3, колонка «Подсветка»)
  if (options.highlight?.dim === true) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(0, 0, width, height)
  }

  // NO_HAND: рамка кадра
  if (options.highlight?.frame === true) {
    ctx.strokeStyle = ALERT_COLOR
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, width - 16, height - 16)
  }

  if (hands.length === 0) return

  const toScreenX = (x: number): number => (options.mirrored ? 1 - x : x) * width
  const toScreenY = (y: number): number => y * height

  const highlightedPoints = new Set(options.highlight?.points ?? [])
  const highlightedEdges = new Set(
    (options.highlight?.edges ?? []).map(([from, to]) => `${from}-${to}|${to}-${from}`),
  )

  for (const hand of hands) {
    for (const connection of HAND_CONNECTIONS) {
      const from = hand.landmarks[connection.start]
      const to = hand.landmarks[connection.end]
      if (from === undefined || to === undefined) continue
      ctx.lineWidth = 2
      ctx.strokeStyle = highlightedEdges.has(`${connection.start}-${connection.end}`)
        ? ALERT_COLOR
        : BONE_COLOR
      ctx.beginPath()
      ctx.moveTo(toScreenX(from.x), toScreenY(from.y))
      ctx.lineTo(toScreenX(to.x), toScreenY(to.y))
      ctx.stroke()
    }

    for (let index = 0; index < hand.landmarks.length; index += 1) {
      const landmark = hand.landmarks[index]
      if (landmark === undefined) continue
      const alert = highlightedPoints.has(index)
      ctx.beginPath()
      ctx.arc(toScreenX(landmark.x), toScreenY(landmark.y), alert ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = alert ? ALERT_COLOR : JOINT_COLOR
      ctx.fill()
    }
  }
}
