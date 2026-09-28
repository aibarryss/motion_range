/**
 * Игровой цикл раунда: мишени, счёт, таймер.
 *
 * Движок знает только замороженный контракт `FrameInput` и не знает, откуда кадр взялся:
 * сейчас это мок с мышью и клавиатурой (`src/vision/mockSource.ts`), позже — реальный vision.
 * Поэтому здесь нет ни одного обращения к камере и ни одной своей копии порогов:
 * числа баланса лежат в `GAME` (`src/shared/consts.ts`).
 */

import { GAME } from '../shared/consts'
import type { FrameInput, HandFrame } from '../shared/types'

/** Как движок получает кадр. Мок и реальный vision подходят сюда структурно. */
export type FrameInputReader = (nowMs: number) => FrameInput

export interface Target {
  id: number
  /** 0..1, экранные координаты центра */
  x: number
  y: number
  /** доля меньшей стороны сцены */
  radius: number
  spawnedAtMs: number
  expiresAtMs: number
}

export interface ShotEvent {
  tMs: number
  /** прицел в момент выстрела; null — руки в кадре не было */
  x: number | null
  y: number | null
  hitTargetId: number | null
}

export interface RoundStats {
  shots: number
  hits: number
  misses: number
  expired: number
}

export interface GameSnapshot {
  tMs: number
  timeLeftMs: number
  score: number
  targets: readonly Target[]
  /** позиция прицела из последнего кадра; null — руки в кадре нет */
  aim: { x: number; y: number } | null
  /** последний кадр целиком: HUD читает из него метрики и диагностику */
  frame: FrameInput
  stats: RoundStats
}

export interface RoundResult extends RoundStats {
  score: number
  durationMs: number
  /** попадания / выстрелы, 0..1; 0 — стрельбы не было */
  accuracy: number
  shotsLog: readonly ShotEvent[]
}

export interface GameEngineDeps {
  readFrame: FrameInputReader
  onFrame: (snapshot: GameSnapshot) => void
  onEnd: (result: RoundResult) => void
}

export class GameEngine {
  private targets: Target[] = []
  private shotsLog: ShotEvent[] = []
  private stats: RoundStats = { shots: 0, hits: 0, misses: 0, expired: 0 }
  private score = 0
  private startedAtMs = 0
  private nextSpawnAtMs = 0
  private nextId = 1
  private rafId: number | null = null
  private running = false

  private readonly deps: GameEngineDeps

  constructor(deps: GameEngineDeps) {
    this.deps = deps
  }

  start(nowMs: number): void {
    if (this.running) return
    this.running = true
    this.startedAtMs = nowMs
    this.nextSpawnAtMs = nowMs
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /** Досрочно закончить раунд (Esc) и получить итог. */
  finishEarly(nowMs: number): RoundResult {
    return this.finish(nowMs)
  }

  private readonly tick = (nowMs: number): void => {
    if (!this.running) return

    const frame = this.deps.readFrame(nowMs)
    const aim = aimOf(frame.hands)

    this.expireTargets(nowMs)
    this.spawnTargets(nowMs)
    if (frame.events.shoot) this.registerShot(nowMs, aim)

    this.deps.onFrame({
      tMs: nowMs,
      timeLeftMs: Math.max(0, GAME.ROUND_MS - (nowMs - this.startedAtMs)),
      score: this.score,
      // копия, а не ссылка: spawnTargets дописывает в this.targets,
      // и снимок кадра иначе менялся бы задним числом
      targets: [...this.targets],
      aim,
      frame,
      stats: { ...this.stats },
    })

    if (nowMs - this.startedAtMs >= GAME.ROUND_MS) {
      this.deps.onEnd(this.finish(nowMs))
      return
    }
    this.rafId = requestAnimationFrame(this.tick)
  }

  private finish(nowMs: number): RoundResult {
    const durationMs = Math.max(0, nowMs - this.startedAtMs)
    this.stop()
    return {
      ...this.stats,
      score: this.score,
      durationMs,
      accuracy: this.stats.shots === 0 ? 0 : this.stats.hits / this.stats.shots,
      shotsLog: this.shotsLog,
    }
  }

  private spawnTargets(nowMs: number): void {
    while (nowMs >= this.nextSpawnAtMs && this.targets.length < GAME.MAX_TARGETS) {
      this.targets.push(this.createTarget(nowMs))
      this.nextSpawnAtMs += randomBetween(GAME.SPAWN_INTERVAL_MIN_MS, GAME.SPAWN_INTERVAL_MAX_MS)
    }
    // после долгой паузы (свёрнутая вкладка) не выстреливаем пачкой мишеней
    if (this.nextSpawnAtMs < nowMs) {
      this.nextSpawnAtMs = nowMs + randomBetween(GAME.SPAWN_INTERVAL_MIN_MS, GAME.SPAWN_INTERVAL_MAX_MS)
    }
  }

  private createTarget(nowMs: number): Target {
    const radius = randomBetween(GAME.TARGET_RADIUS_MIN, GAME.TARGET_RADIUS_MAX)
    const low = GAME.PLAYFIELD_MARGIN + radius
    const high = 1 - GAME.PLAYFIELD_MARGIN - radius
    let x = 0.5
    let y = 0.5
    for (let attempt = 0; attempt < 12; attempt += 1) {
      x = randomBetween(low, high)
      y = randomBetween(low, high)
      const clear = this.targets.every((other) => distance(other, x, y) > other.radius + radius)
      if (clear) break
    }
    const id = this.nextId
    this.nextId += 1
    return {
      id,
      x,
      y,
      radius,
      spawnedAtMs: nowMs,
      expiresAtMs: nowMs + GAME.TARGET_LIFETIME_MS,
    }
  }

  private expireTargets(nowMs: number): void {
    const alive: Target[] = []
    for (const target of this.targets) {
      if (nowMs >= target.expiresAtMs) {
        this.stats.expired += 1
        this.addScore(GAME.SCORE_EXPIRED)
      } else {
        alive.push(target)
      }
    }
    this.targets = alive
  }

  /**
   * Выстрел приходит импульсом `events.shoot` (SPEC §2): один кадр — один выстрел.
   * Источник импульса движку безразличен (жест, пинч-фолбэк, Space в debug-режиме).
   */
  private registerShot(nowMs: number, aim: { x: number; y: number } | null): void {
    this.stats.shots += 1

    let hitId: number | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    if (aim !== null) {
      for (const target of this.targets) {
        const d = distance(target, aim.x, aim.y)
        if (d <= target.radius * GAME.HIT_RADIUS_FACTOR && d < bestDistance) {
          bestDistance = d
          hitId = target.id
        }
      }
    }

    if (hitId === null) {
      this.stats.misses += 1
      this.addScore(GAME.SCORE_MISS)
    } else {
      this.targets = this.targets.filter((target) => target.id !== hitId)
      this.stats.hits += 1
      this.addScore(GAME.SCORE_HIT)
    }

    this.shotsLog.push({
      tMs: nowMs,
      x: aim === null ? null : aim.x,
      y: aim === null ? null : aim.y,
      hitTargetId: hitId,
    })
  }

  private addScore(delta: number): void {
    this.score = Math.max(GAME.SCORE_FLOOR, this.score + delta)
  }
}

/**
 * Прицел первой руки. Пока рамка координат одна на обе оси
 * (пропорции экрана не учитываем) — для мока этого достаточно;
 * при подключении канваса делим x на аспект, иначе круглая мишень на широком экране «вытянется».
 */
function aimOf(hands: readonly HandFrame[]): { x: number; y: number } | null {
  const hand = hands[0]
  if (hand === undefined || hand.gesture === 'NONE') return null
  return { x: hand.x, y: hand.y }
}

function distance(target: Target, x: number, y: number): number {
  return Math.hypot(target.x - x, target.y - y)
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
