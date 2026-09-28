/**
 * Счётчик кадров в секунду за скользящее окно.
 *
 * Один для двух показателей из SPEC §6: `camera fps` (сколько кадров реально отдаёт камера)
 * и `hand fps` (сколько раз в секунду успевает отработать распознавание).
 * Окно нужно потому, что мгновенный fps скачет и по нему нельзя судить о производительности.
 */

export interface FpsMeter {
  /** Отметить кадр. */
  tick(nowMs: number): void
  /** Текущее значение, кадров в секунду. */
  readonly fps: number
}

export function createFpsMeter(windowMs = 500): FpsMeter {
  // отдельный флаг, а не «windowStartMs === 0»: время 0 — законное значение,
  // и на нём счётчик сбрасывался бы на каждом кадре
  let started = false
  let windowStartMs = 0
  let frames = 0
  let value = 0

  return {
    tick(nowMs: number): void {
      if (!started) {
        started = true
        windowStartMs = nowMs
        frames = 1
        return
      }
      frames += 1
      const elapsed = nowMs - windowStartMs
      if (elapsed >= windowMs) {
        value = (frames * 1000) / elapsed
        frames = 0
        windowStartMs = nowMs
      }
    },
    get fps(): number {
      return value
    },
  }
}
