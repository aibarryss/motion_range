import { describe, expect, it } from 'vitest'
import { ENV, FINGER, FIRE, PALM, SCORES, SMOOTH, THUMB } from '../src/shared/consts'

/**
 * «Заморозка» порогов v0.1-contract (src/shared/consts.ts).
 * Ожидаемые значения и отношения зафиксированы в docs/SPEC_Diagnostics_and_Fire.md.
 * Порядок изменения порога: SPEC -> тест -> константа
 * (и только через PR в src/shared/**, см. TASKS.md).
 */

describe('THUMB — thumbExtension (SPEC §1, §3)', () => {
  it('порог кулака и «большой палец отведён» разделены зазором', () => {
    expect(THUMB.FIST_MAX).toBe(0.18) // thumbExtension < 0.18 => палец прижат (кулак)
    expect(THUMB.OUT_MIN).toBe(0.25) // thumbExtension > 0.25 => диагностика THUMB_OUT
    expect(THUMB.FIST_MAX).toBeLessThan(THUMB.OUT_MIN)
  })
})

describe('PALM — frontality / roll / ширина (SPEC §1, §3)', () => {
  it('порог «ладонь к камере» выше порога «ребро»', () => {
    expect(PALM.EDGE).toBe(0.5)
    expect(PALM.FRONT).toBe(0.7)
    expect(PALM.EDGE).toBeLessThan(PALM.FRONT)
  })

  it('roll и дистанция заморожены', () => {
    expect(PALM.ROLL_MAX_DEG).toBe(45)
    expect(PALM.WIDTH_FAR).toBe(0.1)
    expect(PALM.WIDTH_CLOSE).toBe(0.42)
    expect(PALM.WIDTH_FAR).toBeLessThan(PALM.WIDTH_CLOSE)
  })
})

describe('FINGER — изгибы и нормализация (SPEC §1)', () => {
  it('диапазоны «согнут / разогнут» не пересекаются', () => {
    expect(FINGER.CURLED_MAX_DEG).toBe(150)
    expect(FINGER.STRAIGHT_MIN_DEG).toBe(165)
    expect(FINGER.CURLED_MAX_DEG).toBeLessThan(FINGER.STRAIGHT_MIN_DEG)
  })

  it('нормировки tip->palm и wrist->tip в единицах ширины ладони', () => {
    expect(FINGER.TIP_TO_PALM).toBe(0.6)
    expect(FINGER.WRIST_TIP).toBe(1.4)
    expect(FINGER.TIP_TO_PALM).toBeGreaterThan(0)
  })
})

describe('SCORES — гистерезис входа/выхода (SPEC §2)', () => {
  it('ENTER выше HOLD (антидребезг)', () => {
    expect(SCORES.HOLD).toBe(0.6)
    expect(SCORES.ENTER).toBe(0.8)
    expect(SCORES.HOLD).toBeLessThan(SCORES.ENTER)
  })
})

describe('FIRE — автомат выстрела (SPEC §2)', () => {
  it('dwell/окно/кулдаун в границах спецификации', () => {
    expect(FIRE.FIST_DWELL_MS).toBeGreaterThanOrEqual(80)
    expect(FIRE.FIST_DWELL_MS).toBeLessThanOrEqual(120)
    expect(FIRE.OPEN_DWELL_MS).toBeGreaterThanOrEqual(50)
    expect(FIRE.OPEN_DWELL_MS).toBeLessThanOrEqual(80)
    expect(FIRE.COOLDOWN_MS).toBeGreaterThanOrEqual(200)
    expect(FIRE.COOLDOWN_MS).toBeLessThanOrEqual(300)
  })

  it('окно раскрытия 400 мс, «слишком медленно» больше окна', () => {
    expect(FIRE.OPEN_WINDOW_MS).toBe(400)
    expect(FIRE.TOO_SLOW_MS).toBe(600)
    expect(FIRE.TOO_SLOW_MS).toBeGreaterThan(FIRE.OPEN_WINDOW_MS)
  })

  it('зафиксированные значения dwell/cooldown', () => {
    expect(FIRE.FIST_DWELL_MS).toBe(100)
    expect(FIRE.OPEN_DWELL_MS).toBe(60)
    expect(FIRE.COOLDOWN_MS).toBe(250)
  })
})

describe('ENV — диагностика среды (SPEC §3)', () => {
  it('пороги заморожены', () => {
    expect(ENV.BRIGHTNESS_MIN).toBe(60)
    expect(ENV.CONFIDENCE_MIN).toBe(0.5)
    expect(ENV.OFFSCREEN_MARGIN).toBe(0.9)
    expect(ENV.OFFSCREEN_POINTS).toBe(3)
    expect(ENV.NO_HAND_MS).toBe(500)
    expect(ENV.FPS_MIN).toBe(18)
  })
})

describe('SMOOTH — сглаживание и частота детекта (SPEC §1, §6)', () => {
  it('параметры в разумных границах', () => {
    expect(SMOOTH.AIM_EMA).toBeGreaterThan(0)
    expect(SMOOTH.AIM_EMA).toBeLessThan(1)
    expect(SMOOTH.GESTURE_DWELL_FRAMES).toBeGreaterThanOrEqual(1)
    expect(SMOOTH.DETECT_INTERVAL_MS).toBeGreaterThanOrEqual(16)
    expect(SMOOTH.DETECT_INTERVAL_MS).toBeLessThanOrEqual(34)
  })

  it('зафиксированные значения', () => {
    expect(SMOOTH.AIM_EMA).toBe(0.35)
    expect(SMOOTH.GESTURE_DWELL_FRAMES).toBe(3)
    expect(SMOOTH.DETECT_INTERVAL_MS).toBe(33)
  })
})
