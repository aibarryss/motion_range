import { describe, expect, it } from 'vitest'
import type { DiagnosticCode, Gesture, HandFrame } from '../src/shared/types'
import { emptyFrameInput, sampleFrameInput } from './fixtures/frame-input.example'

/**
 * «Заморозка» типового контракта v0.1-contract (src/shared/types.ts).
 * Тест остаётся сборным только пока состав union'ов и поля структур совпадают
 * с замороженными. Если проверка падает — сначала обсудите изменение контракта
 * вдвоём (см. TASKS.md), обновите types.ts, затем тест.
 */

describe('contract: Gesture', () => {
  it('состав union заморожен: ровно AIM/SHOOT/SHIELD/NONE', () => {
    // Record<Gesture, true> не скомпилируется при добавлении/переименовании варианта
    const all: Record<Gesture, true> = {
      AIM: true,
      SHOOT: true,
      SHIELD: true,
      NONE: true,
    }
    const keys = Object.keys(all)
    expect(keys).toHaveLength(4)
    expect(keys).toEqual(expect.arrayContaining(['AIM', 'SHOOT', 'SHIELD', 'NONE']))
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

describe('contract: FrameInput fixtures', () => {
  it('валидный пример собирается и соответствует ограничениям контракта', () => {
    expect(sampleFrameInput.hands.length).toBeGreaterThan(0)
    expect(sampleFrameInput.hands.length).toBeLessThanOrEqual(2)
    expect(sampleFrameInput.fps).toBeGreaterThan(0)
    expect(emptyFrameInput.hands).toHaveLength(0)
  })
})

describe('contract: негативные случаи', () => {
  it('проверки @ts-expect-error отрабатывают во время typecheck', () => {
    // @ts-expect-error невалидный литерал жеста
    const badGesture: Gesture = 'FIRE'
    // @ts-expect-error в HandFrame отсутствует обязательное поле y
    const badHand: HandFrame = { gesture: 'AIM', handedness: 'R', x: 0.5, confidence: 0.9 }
    void badGesture
    void badHand
  })
})
