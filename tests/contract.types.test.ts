import { describe, expect, it } from 'vitest'
import type { Diagnostic, DiagnosticCode, Gesture, HandFrame } from '../src/shared/types'
import { emptyFrameInput, sampleDiagnostic, sampleFrameInput } from './fixtures/frame-input.example'

/**
 * «Заморозка» типового контракта v0.2 (src/shared/types.ts).
 * Тест остаётся сборным только пока состав union'ов и поля структур совпадают
 * с замороженными. Если проверка падает — сначала обсудите изменение контракта
 * вдвоём (см. TASKS.md), обновите types.ts, затем тест.
 */

describe('contract: Gesture', () => {
  it('состав union заморожен: ровно AIM/SHIELD/FIST/NONE (v0.2: без SHOOT)', () => {
    // Record<Gesture, true> не скомпилируется при добавлении/переименовании варианта
    const all: Record<Gesture, true> = {
      AIM: true,
      SHIELD: true,
      FIST: true,
      NONE: true,
    }
    const keys = Object.keys(all)
    expect(keys).toHaveLength(4)
    expect(keys).toEqual(expect.arrayContaining(['AIM', 'SHIELD', 'FIST', 'NONE']))
  })

  it('выстрел приходит импульсом, а не состоянием руки', () => {
    expect(sampleFrameInput.events.shoot).toBe(false)
    expect(Object.keys(sampleFrameInput.events)).toEqual(['shoot'])
  })
})

describe('contract: DiagnosticCode', () => {
  it('состав union заморожен: ровно 11 кодов', () => {
    const all: Record<DiagnosticCode, true> = {
      NO_HAND: true,
      HAND_OFFSCREEN: true,
      TOO_CLOSE: true,
      TOO_FAR: true,
      TOO_DARK: true,
      LOW_CONFIDENCE: true,
      THUMB_OUT: true,
      PALM_ROLL: true,
      PALM_EDGE: true,
      SHOOT_TOO_SLOW: true,
      SLOW_FPS: true,
    }
    const keys = Object.keys(all)
    expect(keys).toHaveLength(11)
    expect(keys).toEqual(
      expect.arrayContaining([
        'NO_HAND',
        'HAND_OFFSCREEN',
        'TOO_CLOSE',
        'TOO_FAR',
        'TOO_DARK',
        'LOW_CONFIDENCE',
        'THUMB_OUT',
        'PALM_ROLL',
        'PALM_EDGE',
        'SHOOT_TOO_SLOW',
        'SLOW_FPS',
      ]),
    )
  })
})

describe('contract: диагностика обязана нести числа', () => {
  it('MetricReading содержит значение, порог и направление сравнения', () => {
    const m = sampleDiagnostic.metric
    expect(Number.isFinite(m.value)).toBe(true)
    expect(Number.isFinite(m.limit)).toBe(true)
    expect(['lt', 'lte', 'gt', 'gte']).toContain(m.comparator)
    expect(m.value).toBeLessThan(m.limit) // LOW_CONFIDENCE: confidence < порога
  })

  it('подсветка задана для диагностики, которую видит игрок', () => {
    expect(sampleDiagnostic.highlight?.points?.length).toBe(21)
    expect(sampleDiagnostic.handedness).toBe('L')
  })
})

describe('contract: FrameInput fixtures', () => {
  it('валидный пример собирается и соответствует ограничениям контракта', () => {
    expect(sampleFrameInput.hands.length).toBeGreaterThan(0)
    expect(sampleFrameInput.hands.length).toBeLessThanOrEqual(2)
    expect(sampleFrameInput.metrics.detectFps).toBeGreaterThan(0)
    expect(sampleFrameInput.metrics.brightness).toBeGreaterThan(0)
    expect(sampleFrameInput.tMs).toBeGreaterThan(0)
    expect(emptyFrameInput.hands).toHaveLength(0)
  })

  it('калибровка необязательна: null пока игрок её не прошёл', () => {
    expect(sampleFrameInput.calibration).toBeNull()
  })
})

describe('contract: негативные случаи', () => {
  it('проверки @ts-expect-error отрабатывают во время typecheck', () => {
    // @ts-expect-error невалидный литерал жеста
    const badGesture: Gesture = 'FIRE'
    // @ts-expect-error в HandFrame отсутствует обязательное поле y
    const badHand: HandFrame = { gesture: 'AIM', handedness: 'R', x: 0.5, confidence: 0.9 }
    // @ts-expect-error в v0.2 у Diagnostic нет поля measured — числа живут в metric
    const badDiag: Diagnostic = { ...sampleDiagnostic, measured: 0.44 }
    void badGesture
    void badHand
    void badDiag
  })
})
