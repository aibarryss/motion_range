/**
 * Тесты игровых правил (src/game/engine.ts).
 *
 * Правила раунда — чистая логика: счёт, попадание, просрочка мишени, конец раунда.
 * Проверяются без браузера и камеры: кадр подставляет тест, время двигает тест,
 * `requestAnimationFrame` подменён очередью, чтобы шаги были детерминированными.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GAME, ZERO_FEATURES } from '../src/shared/consts'
import {
  GameEngine,
  type GameSnapshot,
  type RoundResult,
  type Target,
} from '../src/game/engine'
import { emptyFrameInput } from './fixtures/frame-input.example'
import type { FrameInput } from '../src/shared/types'

let frameQueue: Array<(nowMs: number) => void> = []

beforeEach(() => {
  frameQueue = []
  vi.stubGlobal('requestAnimationFrame', (callback: (nowMs: number) => void): number => {
    frameQueue.push(callback)
    return frameQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', (): void => {
    frameQueue = []
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Кадр с одной рукой в заданной точке; aim = null — руки не видно. */
function frameAt(
  tMs: number,
  options: { aim?: { x: number; y: number } | null; shoot?: boolean } = {},
): FrameInput {
  const aim = options.aim === undefined ? { x: 0.5, y: 0.5 } : options.aim
  return {
    ...emptyFrameInput,
    tMs,
    hands:
      aim === null
        ? []
        : [
            {
              gesture: 'AIM',
              handedness: 'R',
              x: aim.x,
              y: aim.y,
              confidence: 0.92,
              features: { ...ZERO_FEATURES },
            },
          ],
    events: { shoot: options.shoot === true },
  }
}

interface Harness {
  engine: GameEngine
  snapshots: GameSnapshot[]
  /** Прогнать n тиков, каждый по stepMs миллисекунд. */
  drive(steps: number, stepMs?: number): void
  result(): RoundResult | null
}

function setup(frame: (last: GameSnapshot | null, index: number) => FrameInput): Harness {
  const snapshots: GameSnapshot[] = []
  let last: GameSnapshot | null = null
  let ended: RoundResult | null = null

  const engine = new GameEngine({
    readFrame: (_nowMs: number): FrameInput => frame(last, snapshots.length),
    onFrame: (snapshot: GameSnapshot): void => {
      snapshots.push(snapshot)
      last = snapshot
    },
    onEnd: (result: RoundResult): void => {
      ended = result
    },
  })

  return {
    engine,
    snapshots,
    drive(steps: number, stepMs = 17): void {
      for (let i = 0; i < steps; i += 1) {
        const next = frameQueue.shift()
        if (next === undefined) break
        next(i * stepMs)
      }
    },
    result: (): RoundResult | null => ended,
  }
}

describe('GameEngine: мишени и счёт', () => {
  it('первый тик создаёт мишень в пределах поля', () => {
    const harness = setup((_last, index) => frameAt(index * 17))
    harness.engine.start(0)
    harness.drive(1)

    expect(harness.snapshots).toHaveLength(1)
    const target = harness.snapshots[0]?.targets[0] as Target
    expect(target).toBeDefined()
    expect(target.radius).toBeGreaterThanOrEqual(GAME.TARGET_RADIUS_MIN)
    expect(target.radius).toBeLessThanOrEqual(GAME.TARGET_RADIUS_MAX)
    expect(target.x).toBeGreaterThanOrEqual(GAME.PLAYFIELD_MARGIN)
    expect(target.x).toBeLessThanOrEqual(1 - GAME.PLAYFIELD_MARGIN)
  })

  it('выстрел в центр мишени = попадание и SCORE_HIT', () => {
    const harness = setup((last, index) => {
      const target = last?.targets[0]
      if (target === undefined) return frameAt(index * 17, { aim: { x: 0.5, y: 0.5 } })
      return frameAt(index * 17, { aim: { x: target.x, y: target.y }, shoot: true })
    })
    harness.engine.start(0)
    harness.drive(20)

    const result = harness.engine.finishEarly(400)
    expect(result.hits).toBe(1)
    expect(result.shots).toBe(1)
    expect(result.score).toBe(GAME.SCORE_HIT)
    expect(result.shotsLog[0]?.hitTargetId).not.toBeNull()
  })

  it('выстрел мимо мишени = промах, счёт не уходит ниже нуля', () => {
    // 0.02 — вне игрового поля (отступ PLAYFIELD_MARGIN), значит промах гарантирован
    const aim = { x: 0.02, y: 0.02 }
    const harness = setup((_last, index) => frameAt(index * 17, { aim, shoot: true }))
    harness.engine.start(0)
    harness.drive(5)

    const result = harness.engine.finishEarly(200)
    expect(result.misses).toBe(5)
    expect(result.hits).toBe(0)
    expect(result.score).toBe(GAME.SCORE_FLOOR)
    expect(result.shotsLog.every((shot) => shot.hitTargetId === null)).toBe(true)
  })

  it('не снятая мишень считается просроченной', () => {
    const harness = setup((_last, index) => frameAt(index * 17))
    harness.engine.start(0)
    harness.drive(200)

    const result = harness.engine.finishEarly(200 * 17)
    expect(result.expired).toBeGreaterThanOrEqual(1)
    expect(result.shots).toBe(0)
    expect(result.accuracy).toBe(0)
  })

  it('по времени раунд заканчивается сам и отдаёт итог', () => {
    const harness = setup((_last, index) => frameAt(index * 1000))
    harness.engine.start(0)
    harness.drive(Math.ceil(GAME.ROUND_MS / 1000) + 2, 1000)

    const result = harness.result()
    expect(result).not.toBeNull()
    expect(result?.durationMs).toBeGreaterThanOrEqual(GAME.ROUND_MS)
  })

  it('снимок кадра не меняется задним числом', () => {
    const harness = setup((_last, index) => frameAt(index * 17))
    harness.engine.start(0)
    harness.drive(1)

    const first = harness.snapshots[0]
    expect(first).toBeDefined()
    const countAtFirstFrame = first?.targets.length ?? 0

    harness.drive(120)
    expect(first?.targets.length).toBe(countAtFirstFrame)
    expect(harness.snapshots.length).toBeGreaterThan(1)
  })
})
