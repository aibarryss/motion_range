/**
 * Экран PLAY: сцена с мишенями, HUD, Signal Doctor и карточка диагностики.
 *
 * Источник кадров подключается ОДНОЙ строкой в `mount` — здесь создаётся мок
 * (`createKeyboardMockSource`). После задачи «vision» вместо него встанет реальный
 * источник, а этот экран не изменится: он читает только `FrameInput`.
 */

import { GAME } from '../../shared/consts'
import { primaryDiagnostic } from '../../shared/diagnostics'
import { GameEngine, type GameSnapshot } from '../../game/engine'
import { createKeyboardMockSource, type MockSource } from '../../vision/mockSource'
import { createDiagnosticCard, createSignalDoctor } from '../diagnostic'
import { button, el } from '../dom'
import { createHud } from '../hud'
import type { AppContext, Screen } from '../router'

/** Временная шпаргалка мок-ввода. Уйдёт вместе с моком. */
const MOCK_CONTROLS: readonly string[] = [
  'мышь — рука и прицел',
  'Space или клик — выстрел',
  'F (держать) — кулак, HUD покажет ARMED',
  'S (держать) — щит',
  'L (держать) — темно → диагностика TOO_DARK',
  'C (держать) — низкая уверенность → LOW_CONFIDENCE',
  'Esc — закончить раунд',
]

export function createPlayScreen(ctx: AppContext): Screen {
  const root = el('section', 'play')
  const stage = el('div', 'play__stage')
  const canvas = el('canvas', 'play__canvas')

  const hud = createHud()
  const doctor = createSignalDoctor()
  const card = createDiagnosticCard()
  stage.append(canvas, hud.root)

  const side = el('aside', 'play__side')
  const controls = el('details', 'controls')
  controls.append(el('summary', 'controls__summary', 'Управление (мок-ввод)'))
  const controlsList = el('ul', 'controls__list')
  for (const item of MOCK_CONTROLS) controlsList.append(el('li', undefined, item))
  controls.append(controlsList)

  side.append(doctor.root, card.root, controls, button('Закончить раунд', () => finishRound(performance.now()), 'ghost'))
  root.append(stage, side)

  let engine: GameEngine | null = null
  let source: MockSource | null = null
  let ended = false

  function finishRound(nowMs: number): void {
    if (ended || engine === null) return
    ended = true
    ctx.lastResult = engine.finishEarly(nowMs)
    ctx.go('GAMEOVER')
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') finishRound(performance.now())
  }

  function draw(snapshot: GameSnapshot): void {
    const cssWidth = canvas.clientWidth
    const cssHeight = canvas.clientHeight
    if (cssWidth === 0 || cssHeight === 0) return

    const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
    const width = Math.round(cssWidth * dpr)
    const height = Math.round(cssHeight * dpr)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const g = canvas.getContext('2d')
    if (g === null) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, cssWidth, cssHeight)

    const minSide = Math.min(cssWidth, cssHeight)
    for (const target of snapshot.targets) {
      const life = Math.max(0, Math.min(1, (target.expiresAtMs - snapshot.tMs) / GAME.TARGET_LIFETIME_MS))
      const cx = target.x * cssWidth
      const cy = target.y * cssHeight
      const radius = target.radius * minSide

      g.beginPath()
      g.arc(cx, cy, radius, 0, Math.PI * 2)
      g.fillStyle = 'rgba(76, 194, 255, 0.14)'
      g.fill()
      g.lineWidth = 2
      g.strokeStyle = `rgba(76, 194, 255, ${(0.3 + 0.7 * life).toFixed(2)})`
      g.stroke()

      g.beginPath()
      g.arc(cx, cy, radius * 0.4, 0, Math.PI * 2)
      g.fillStyle = 'rgba(76, 194, 255, 0.3)'
      g.fill()
    }

    if (snapshot.aim !== null) {
      const cx = snapshot.aim.x * cssWidth
      const cy = snapshot.aim.y * cssHeight
      g.strokeStyle = '#ffd166'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(cx - 16, cy)
      g.lineTo(cx - 5, cy)
      g.moveTo(cx + 5, cy)
      g.lineTo(cx + 16, cy)
      g.moveTo(cx, cy - 16)
      g.lineTo(cx, cy - 5)
      g.moveTo(cx, cy + 5)
      g.lineTo(cx, cy + 16)
      g.stroke()
    }
  }

  return {
    id: 'PLAY',

    mount(host: HTMLElement): void {
      host.append(root)
      window.addEventListener('keydown', onKeyDown)

      source = createKeyboardMockSource()
      engine = new GameEngine({
        readFrame: source.read,
        onFrame: (snapshot: GameSnapshot): void => {
          draw(snapshot)
          hud.update(snapshot.frame, snapshot.score, snapshot.timeLeftMs)
          const diagnostic = primaryDiagnostic(snapshot.frame.diagnostics)
          doctor.update(diagnostic, snapshot.frame.metrics.brightness)
          card.update(diagnostic)
        },
        onEnd: (result): void => {
          if (ended) return
          ended = true
          ctx.lastResult = result
          ctx.go('GAMEOVER')
        },
      })
      engine.start(performance.now())
    },

    unmount(): void {
      ended = true
      window.removeEventListener('keydown', onKeyDown)
      engine?.stop()
      engine = null
      source?.dispose()
      source = null
      root.remove()
    },
  }
}
