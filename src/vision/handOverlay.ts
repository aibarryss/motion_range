/**
 * Отрисовка скелета руки поверх видео: 21 точка и связи между ними.
 *
 * Почему рисует vision, а не игровой слой: в контракте `HandFrame` есть только
 * координата прицела и признаки — самих 21 точки там нет (это записано в CODE_REVIEW
 * как открытое решение). Vision эти точки уже держит в руках, поэтому и рисует их сам,
 * на отдельном холсте. Игровой слой остаётся про мишени и счёт.
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

export function drawHandsOverlay(
  canvas: HTMLCanvasElement,
  hands: readonly DetectedHand[],
  options: OverlayOptions,
): void {
  const fitted = fitCanvas(canvas)
  if (fitted === null) return
  const { ctx, width, height } = fitted

  ctx.clearRect(0, 0, width, height)
  if (hands.length === 0) return

  const toScreenX = (x: number): number => (options.mirrored ? 1 - x : x) * width
  const toScreenY = (y: number): number => y * height

  const highlightedPoints = new Set(options.highlight?.points ?? [])
  const highlightedEdges = new Set(
    (options.highlight?.edges ?? []).map(([from, to]) => `${from}-${to}|${to}-${from}`),
  )

  for (const hand of hands) {
    ctx.lineWidth = 2
    ctx.strokeStyle = BONE_COLOR
    for (const connection of HAND_CONNECTIONS) {
      const from = hand.landmarks[connection.start]
      const to = hand.landmarks[connection.end]
      if (from === undefined || to === undefined) continue
      const alert = highlightedEdges.has(`${connection.start}-${connection.end}`)
      ctx.strokeStyle = alert ? ALERT_COLOR : BONE_COLOR
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
