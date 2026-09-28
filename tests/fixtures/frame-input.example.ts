/**
 * Примеры FrameInput для тестов и фикстур (контракт v0.3).
 * Реальные типы: src/shared/types.ts
 */
import { ZERO_FEATURES } from '../../src/shared/consts'
import type { Diagnostic, FrameInput } from '../../src/shared/types'

/** Диагностика «камера не уверена»: несёт измеренное значение и порог. */
export const sampleDiagnostic: Diagnostic = {
  code: 'LOW_CONFIDENCE',
  severity: 'block',
  message: 'Камера не уверена в положении руки',
  hint: 'Убери руку от корпуса и поверни ладонь к камере',
  metric: {
    name: 'handConfidence',
    value: 0.44,
    limit: 0.5,
    comparator: 'lt',
    unit: 'ratio',
  },
  handedness: 'L',
  highlight: { points: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
}

/** Кадр с двумя руками: правая ведёт прицел, левая не распознана как жест. */
export const sampleFrameInput: FrameInput = {
  tMs: 1234.5,
  hands: [
    {
      gesture: 'AIM',
      handedness: 'R',
      x: 0.61,
      y: 0.42,
      confidence: 0.94,
      features: {
        fistScore: 0,
        openPalmScore: 0.25,
        thumbIndexDeg: 12,
        palmFrontality: 0.86,
        palmWidthRatio: 0.21,
        palmRollDeg: 8,
        openingSpeedMs: null,
        fingerCurlDeg: [170, 150, 145, 150],
      },
    },
    {
      gesture: 'NONE',
      handedness: 'L',
      x: 0.38,
      y: 0.55,
      confidence: 0.44,
      features: { ...ZERO_FEATURES, thumbIndexDeg: 22 },
    },
  ],
  player: {
    leanX: -0.12,
    duck: 0,
  },
  events: {
    shoot: false,
  },
  // кадр сразу после выстрела: палец ещё прижат, импульс был на прошлом кадре
  fire: {
    state: 'COOLDOWN',
    heldMs: 40,
  },
  diagnostics: [sampleDiagnostic],
  metrics: {
    cameraFps: 30.1,
    detectFps: 29.8,
    poseFps: 12.1,
    latencyMs: 62,
    brightness: 142,
  },
  calibration: null,
}

/** Пустой кадр: руки не найдены. */
export const emptyFrameInput: FrameInput = {
  tMs: 0,
  hands: [],
  player: { leanX: 0, duck: 0 },
  events: { shoot: false },
  fire: { state: 'IDLE', heldMs: 0 },
  diagnostics: [],
  metrics: {
    cameraFps: 0,
    detectFps: 0,
    poseFps: null,
    latencyMs: 0,
    brightness: 0,
  },
  calibration: null,
}
