/**
 * Холст под размер его CSS-квадрата с учётом плотности экрана.
 *
 * Зачем отдельный файл: и игровой слой (мишени), и слой скелета руки должны
 * совпадать пиксель в пиксель, иначе скелет «уезжает» от картинки на retina-экранах.
 * Логика одна на двух потребителей.
 */

export interface FittedCanvas {
  ctx: CanvasRenderingContext2D
  /** размеры в CSS-пикселях — в них и рисуем после setTransform */
  width: number
  height: number
}

export function fitCanvas(canvas: HTMLCanvasElement): FittedCanvas | null {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width === 0 || height === 0) return null

  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width, height }
}
