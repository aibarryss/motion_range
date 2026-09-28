/**
 * Примеры FrameInput для тестов и фикстур (контракт v0.1-contract).
 * Реальные типы: src/shared/types.ts
 */
import type { FrameInput } from '../../src/shared/types'

/** Кадр с двумя руками и одной диагностикой. */
export const sampleFrameInput: FrameInput = {
  hands: [
    {
      gesture: 'AIM',
      handedness: 'R',
      x: 0.61,
      y: 0.42,
      confidence: 0.94,
    },
    {
      gesture: 'NONE',
      handedness: 'L',
      x: 0.38,
      y: 0.55,
      confidence: 0.81,
    },
  ],
  player: {
    leanX: -0.12,
    duck: 0,
  },
  diagnostics: [
    {
      code: 'LOW_CONFIDENCE',
      severity: 'info',
      message: 'Камера не уверена в положении руки',
      hint: 'Убери руку от корпуса и поверни ладонь к камере',
      measured: 0.81,
    },
  ],
  fps: 29.8,
}

/** Пустой кадр: руки не найдены. */
export const emptyFrameInput: FrameInput = {
  hands: [],
  player: { leanX: 0, duck: 0 },
  diagnostics: [],
  fps: 0,
}
