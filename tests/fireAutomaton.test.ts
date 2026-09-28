/**
 * Тесты автомата выстрела (SPEC §2): курок — большой палец.
 *
 * Логика чистая: время и значение `thumbIndexDeg` задаём сами, камера не нужна.
 * Проверяем не только «выстрел есть», но и защиты: подтверждение позы, гистерезис,
 * пауза между выстрелами и то, что потеря руки выстрела не даёт.
 */

import { describe, expect, it } from 'vitest'
import { FIRE, THUMB } from '../src/shared/consts'
import { createFireAutomaton, type FireAutomaton, type FireDecision } from '../src/vision/fireAutomaton'

/** Палец отведён в сторону: рука готова к выстрелу. */
const EXTENDED = THUMB.EXTENDED_MIN_DEG + 15
/** Палец прижат, идёт вдоль указательного: курок нажат. */
const TUCKED = THUMB.TUCKED_MAX_DEG - 10
/** Значение между порогами: решение не должно меняться (гистерезис). */
const DEAD_ZONE = (THUMB.TUCKED_MAX_DEG + THUMB.EXTENDED_MIN_DEG) / 2

function step(
  automaton: FireAutomaton,
  nowMs: number,
  thumb: number | null,
  aiming = true,
): FireDecision {
  return automaton.update({ aiming, thumbIndexDeg: thumb, nowMs })
}

describe('автомат выстрела: курок — большой палец', () => {
  it('без руки состояние IDLE и выстрела нет', () => {
    const automaton = createFireAutomaton()
    const decision = step(automaton, 0, null, false)
    expect(decision.state).toBe('IDLE')
    expect(decision.shoot).toBe(false)
  })

  it('отведённый палец переводит в готовность, выстрела при этом нет', () => {
    const automaton = createFireAutomaton()
    expect(step(automaton, 0, EXTENDED).state).toBe('ARMED')
    expect(step(automaton, 50, EXTENDED).shoot).toBe(false)
  })

  it('прижатие после готовности даёт ровно один выстрел', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)

    // нажатие подтверждается выдержкой FIRE.PULL_DWELL_MS
    expect(step(automaton, 120, TUCKED).shoot).toBe(false)

    const shot = step(automaton, 120 + FIRE.PULL_DWELL_MS, TUCKED)
    expect(shot.shoot).toBe(true)
    expect(shot.state).toBe('FIRE')

    // импульс живёт один кадр, дальше пауза
    expect(step(automaton, 200, TUCKED).state).toBe('COOLDOWN')
    expect(step(automaton, 210, TUCKED).shoot).toBe(false)
  })

  it('прижатие раньше готовности — не выстрел', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)
    expect(step(automaton, FIRE.READY_DWELL_MS - 20, TUCKED).state).toBe('IDLE')
    expect(step(automaton, 500, TUCKED).shoot).toBe(false)
  })

  it('мёртвая зона между порогами не меняет решение', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)

    expect(step(automaton, 200, DEAD_ZONE).state).toBe('ARMED')
    expect(step(automaton, 1000, DEAD_ZONE).shoot).toBe(false)
    expect(step(automaton, 1000, DEAD_ZONE).state).toBe('ARMED')

    // а прижатие из мёртвой зоны всё равно стреляет
    step(automaton, 1100, TUCKED)
    expect(step(automaton, 1100 + FIRE.PULL_DWELL_MS, TUCKED).shoot).toBe(true)
  })

  it('пока палец прижат, второго выстрела нет — нужно отвести палец', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)
    step(automaton, 200, TUCKED)
    expect(step(automaton, 200 + FIRE.PULL_DWELL_MS, TUCKED).shoot).toBe(true)

    for (let nowMs = 500; nowMs <= 1200; nowMs += 50) {
      expect(step(automaton, nowMs, TUCKED).shoot).toBe(false)
    }
    expect(step(automaton, 1200, TUCKED).state).toBe('IDLE')
  })

  it('после паузы повторное нажатие снова стреляет', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)
    step(automaton, 200, TUCKED)
    expect(step(automaton, 260, TUCKED).shoot).toBe(true)

    step(automaton, 600, EXTENDED)
    expect(step(automaton, 600, EXTENDED).state).toBe('ARMED')

    step(automaton, 720, TUCKED)
    expect(step(automaton, 720 + FIRE.PULL_DWELL_MS, TUCKED).shoot).toBe(true)
  })

  it('без позы прицела не стреляет, даже если палец прижат', () => {
    const automaton = createFireAutomaton()
    expect(step(automaton, 0, EXTENDED, false).state).toBe('IDLE')
    expect(step(automaton, 500, TUCKED, false).shoot).toBe(false)
  })

  it('потеря руки прерывает готовность и не даёт выстрела', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)
    expect(step(automaton, 120, null).state).toBe('IDLE')
    expect(step(automaton, 900, null).shoot).toBe(false)
  })

  it('heldMs считает длительность текущего состояния', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)
    expect(step(automaton, 300, EXTENDED).heldMs).toBe(300)
  })

  it('reset возвращает автомат в исходное состояние', () => {
    const automaton = createFireAutomaton()
    step(automaton, 0, EXTENDED)
    automaton.reset()
    expect(step(automaton, 1000, TUCKED).state).toBe('IDLE')
    expect(step(automaton, 1100, TUCKED).shoot).toBe(false)
  })
})
