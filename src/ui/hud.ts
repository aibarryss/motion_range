/**
 * HUD с метриками (SPEC §6): fps, задержка, уверенность, состояние, счёт, таймер.
 *
 * Честно про контракт: SPEC §6 показывает строку `state ARMED`, но в контракте v0.2
 * состояния автомата нет — `FrameInput` несёт жест руки (`HandFrame.gesture`) и импульс
 * `events.shoot`. Пока состояние выводится из жеста: FIST → ARMED, импульс → FIRE.
 * Нужен точный автомат в HUD (включая COOLDOWN) — это отдельное изменение контракта
 * по правилу «SPEC → тест → types.ts», а не мелкая правка HUD.
 */

import { labeledLine, el, type Line } from './dom'
import type { FrameInput } from '../shared/types'

export interface Hud {
  readonly root: HTMLElement
  update(frame: FrameInput, score: number, timeLeftMs: number): void
}

export function createHud(): Hud {
  const root = el('div', 'hud')

  const metrics = el('div', 'hud__metrics')
  const cameraFps = labeledLine('camera fps', 'hud__line')
  const handFps = labeledLine('hand fps', 'hud__line')
  const poseFps = labeledLine('pose fps', 'hud__line')
  const confidence = labeledLine('confidence', 'hud__line')
  const latency = labeledLine('round-trip', 'hud__line')
  const state = labeledLine('state', 'hud__line')
  const lines: Line[] = [cameraFps, handFps, poseFps, confidence, latency, state]
  for (const line of lines) metrics.append(line.root)

  const scoreNode = el('div', 'hud__score', '0')
  const timerNode = el('div', 'hud__timer', formatTime(0))
  const top = el('div', 'hud__top')
  top.append(scoreNode, timerNode)

  root.append(top, metrics)

  function update(frame: FrameInput, score: number, timeLeftMs: number): void {
    const hand = frame.hands[0]

    cameraFps.set(frame.metrics.cameraFps.toFixed(1))
    handFps.set(frame.metrics.detectFps.toFixed(1))
    poseFps.set(frame.metrics.poseFps === null ? '—' : frame.metrics.poseFps.toFixed(1))
    confidence.set(hand === undefined ? '—' : hand.confidence.toFixed(2))
    latency.set(`${Math.round(frame.metrics.latencyMs)} ms`)
    state.set(automatonState(frame))

    scoreNode.textContent = String(score)
    timerNode.textContent = formatTime(timeLeftMs)
  }

  return { root, update }
}

/** Приближение состояния автомата по тому, что реально есть в контракте. */
function automatonState(frame: FrameInput): string {
  if (frame.events.shoot) return 'FIRE'
  const hand = frame.hands[0]
  if (hand === undefined) return 'IDLE'
  switch (hand.gesture) {
    case 'FIST':
      return 'ARMED'
    case 'SHIELD':
      return 'SHIELD'
    case 'AIM':
    case 'NONE':
      return 'IDLE'
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
