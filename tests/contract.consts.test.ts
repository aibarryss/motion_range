import { describe, expect, it } from 'vitest'
import {
  ENV,
  FINGER,
  FIRE,
  OPENING,
  PALM,
  SCORES,
  SEVERITY_ORDER,
  SMOOTH,
  THUMB,
  ZERO_FEATURES,
} from '../src/shared/consts'

/**
 * «Заморозка» порогов v0.3 (src/shared/consts.ts).
 * Ожидаемые значения и отношения зафиксированы в docs/SPEC_Diagnostics_and_Fire.md.
 * Порядок изменения порога: SPEC -> тест -> константа
 * (и только через PR в src/shared/**, см. TASKS.md).
 */

describe('THUMB — курок: большой палец (SPEC §1, §2)', () => {
  it('пороги «прижат» и «отведён» разделены зазором', () => {
    expect(THUMB.TUCKED_MAX).toBe(0.18) // thumbExtension < 0.18 => палец прижат, курок нажат
    expect(THUMB.EXTENDED_MIN).toBe(0.25) // thumbExtension > 0.25 => рука готова к выстрелу
    expect(THUMB.TUCKED_MAX).toBeLessThan(THUMB.EXTENDED_MIN)
    // зазор — это зона гистерезиса: внутри неё решение автомата не меняется
    expect(THUMB.EXTENDED_MIN - THUMB.TUCKED_MAX).toBeGreaterThan(0.05)
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
  // Внутри автомата выстрела эти пороги больше не участвуют: курок — большой палец,
  // а для него свои THUMB.TUCKED_MAX / EXTENDED_MIN. SCORES заняты признаками
  // (переход кулак -> ладонь) и остаются в запасе для щита.
  it('ENTER выше HOLD (антидребезг)', () => {
    expect(SCORES.HOLD).toBe(0.6)
    expect(SCORES.ENTER).toBe(0.8)
    expect(SCORES.HOLD).toBeLessThan(SCORES.ENTER)
  })
})

describe('FIRE — автомат выстрела (SPEC §2)', () => {
  it('выдержки готовности и нажатия, пауза — в границах спецификации', () => {
    expect(FIRE.READY_DWELL_MS).toBeGreaterThanOrEqual(80)
    expect(FIRE.READY_DWELL_MS).toBeLessThanOrEqual(120)
    expect(FIRE.PULL_DWELL_MS).toBeGreaterThanOrEqual(50)
    expect(FIRE.PULL_DWELL_MS).toBeLessThanOrEqual(80)
    expect(FIRE.COOLDOWN_MS).toBeGreaterThanOrEqual(200)
    expect(FIRE.COOLDOWN_MS).toBeLessThanOrEqual(300)
  })

  it('нажатие подтверждается быстрее готовности, иначе выстрел опаздывает', () => {
    expect(FIRE.PULL_DWELL_MS).toBeLessThan(FIRE.READY_DWELL_MS)
  })

  it('зафиксированные значения выдержек и паузы', () => {
    expect(FIRE.READY_DWELL_MS).toBe(100)
    expect(FIRE.PULL_DWELL_MS).toBe(60)
    expect(FIRE.COOLDOWN_MS).toBe(250)
  })
})

describe('OPENING — окно измерения раскрытия ладони (SPEC §1)', () => {
  it('окно заморожено', () => {
    expect(OPENING.WINDOW_MS).toBe(400)
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

describe('SEVERITY_ORDER — приоритет показа (SPEC §3.1, §5)', () => {
  it('block важнее warn, warn важнее info', () => {
    expect(SEVERITY_ORDER.block).toBeLessThan(SEVERITY_ORDER.warn)
    expect(SEVERITY_ORDER.warn).toBeLessThan(SEVERITY_ORDER.info)
  })
})

describe('ZERO_FEATURES — снапшот для мока и заглушек', () => {
  it('нулевой, но валидный: согласован с контрактом HandFeatures', () => {
    expect(ZERO_FEATURES.fistScore).toBe(0)
    expect(ZERO_FEATURES.openingSpeedMs).toBeNull()
    expect(ZERO_FEATURES.fingerCurlDeg).toHaveLength(4)
  })
})
