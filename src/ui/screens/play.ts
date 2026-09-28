/**
 * Экран PLAY: видео с камеры, скелет руки, мишени, HUD, Signal Doctor, карточка диагностики.
 *
 * Источник кадров подключается в одном месте — `startVision()` или `startMock()`. Игровой
 * движок читает только `FrameInput`, поэтому подмена источника не трогает ни мишени, ни счёт.
 *
 * Камера — основной режим. Мок остаётся как запасной: он включается по `?input=mock`
 * и предлагается кнопкой, если камера не запустилась (на демо это спасает показ).
 */

import { GAME } from '../../shared/consts'
import { primaryDiagnostic } from '../../shared/diagnostics'
import { GameEngine, type GameSnapshot, type RoundResult } from '../../game/engine'
import type { FrameInput } from '../../shared/types'
import { CameraError } from '../../vision/camera'
import { createKeyboardMockSource, type MockSource } from '../../vision/mockSource'
import { createVisionSource, emptyFrameInput, type VisionSource } from '../../vision/visionSource'
import { fitCanvas } from '../canvas'
import { createDiagnosticCard, createSignalDoctor } from '../diagnostic'
import { button, el } from '../dom'
import { createHud } from '../hud'
import type { AppContext, Screen } from '../router'

type InputMode = 'vision' | 'mock'

const VISION_CONTROLS: readonly string[] = [
  'наведи указательный палец на экран — прицел идёт за кончиком пальца',
  'Space — пробный выстрел (временный фолбэк: автомат жеста ещё не подключён)',
  'Esc — закончить раунд',
]

const MOCK_CONTROLS: readonly string[] = [
  'мышь — рука и прицел',
  'Space или клик — выстрел',
  'F (держать) — кулак, HUD покажет ARMED',
  'S (держать) — щит',
  'L (держать) — темно → диагностика TOO_DARK',
  'C (держать) — низкая уверенность → LOW_CONFIDENCE',
  'Esc — закончить раунд',
]

/** `?input=mock` — играть без камеры (отладка интерфейса и запасной вариант на демо). */
function requestedMode(): InputMode {
  return new URLSearchParams(window.location.search).get('input') === 'mock' ? 'mock' : 'vision'
}

export function createPlayScreen(ctx: AppContext): Screen {
  const root = el('section', 'play')

  const frameBox = el('div', 'play__stage-frame')
  const stage = el('div', 'play__stage')
  const canvas = el('canvas', 'play__canvas')
  const status = el('div', 'play__status')
  const hud = createHud()
  status.hidden = true
  stage.append(canvas, hud.root)
  frameBox.append(stage)

  const doctor = createSignalDoctor()
  const card = createDiagnosticCard()
  const controlsList = el('ul', 'controls__list')
  const controls = el('details', 'controls')
  controls.append(el('summary', 'controls__summary', 'Управление'), controlsList)
  const side = el('aside', 'play__side')
  side.append(doctor.root, card.root, controls, button('Закончить раунд', () => finishRound(performance.now()), 'ghost'))
  root.append(frameBox, side)

  let engine: GameEngine | null = null
  let mock: MockSource | null = null
  let vision: VisionSource | null = null
  let mountedVideo: HTMLVideoElement | null = null
  let readFrame: (nowMs: number) => FrameInput = emptyFrameInput
  let ended = false

  function showStatus(title: string, lines: readonly string[], actions: readonly HTMLElement[]): void {
    const box = el('div', 'play__status-box')
    box.append(el('div', 'play__status-title', title))
    for (const line of lines) box.append(el('p', 'note', line))
    if (actions.length > 0) {
      const row = el('div', 'actions')
      for (const action of actions) row.append(action)
      box.append(row)
    }
    status.replaceChildren(box)
    status.hidden = false
  }

  function hideStatus(): void {
    status.hidden = true
  }

  function setControls(items: readonly string[]): void {
    controlsList.replaceChildren()
    for (const item of items) controlsList.append(el('li', undefined, item))
  }

  function startEngine(): void {
    if (engine !== null) return
    engine = new GameEngine({
      readFrame: (nowMs: number): FrameInput => readFrame(nowMs),
      onFrame,
      onEnd,
    })
    engine.start(performance.now())
  }

  function onFrame(snapshot: GameSnapshot): void {
    draw(snapshot)
    hud.update(snapshot.frame, snapshot.score, snapshot.timeLeftMs)
    const diagnostic = primaryDiagnostic(snapshot.frame.diagnostics)
    doctor.update(diagnostic, snapshot.frame.metrics.brightness)
    card.update(diagnostic)
  }

  function onEnd(result: RoundResult): void {
    if (ended) return
    ended = true
    ctx.lastResult = result
    ctx.go('GAMEOVER')
  }

  function stopVision(): void {
    if (vision === null) return
    mountedVideo?.remove()
    mountedVideo = null
    vision.overlay.remove()
    vision.dispose()
    vision = null
  }

  function startMock(): void {
    stopVision()
    hideStatus()
    mock = createKeyboardMockSource()
    readFrame = mock.read
    setControls(MOCK_CONTROLS)
    startEngine()
  }

  function startVision(): void {
    stopVision()
    showStatus(
      'Включаю камеру…',
      [
        'Первый запуск загружает модель распознавания (7,8 МБ) с нашего же сайта — потом браузер берёт её из кэша.',
        'Если браузер спросит про камеру — разреши доступ.',
      ],
      [],
    )

    vision = createVisionSource()
    vision
      .start()
      .then(() => {
        const source = vision
        if (source === null) return
        mountedVideo = source.video
        stage.insertBefore(mountedVideo, stage.firstChild)
        stage.insertBefore(source.overlay, canvas)
        readFrame = source.read
        setControls(VISION_CONTROLS)
        hideStatus()
        startEngine()
      })
      .catch((error: unknown) => {
        stopVision()
        const message =
          error instanceof CameraError
            ? error.message
            : 'Камеру не удалось включить. Проверь доступ к ней в настройках браузера.'
        showStatus(
          'Камера не запустилась',
          [message, 'Можно продолжить без камеры: мышь вместо руки, Space вместо жеста выстрела.'],
          [button('Повторить', () => startVision(), 'ghost'), button('Играть без камеры', () => startMock())],
        )
      })
  }

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
    const fitted = fitCanvas(canvas)
    if (fitted === null) return
    const { ctx: g, width, height } = fitted
    g.clearRect(0, 0, width, height)

    const minSide = Math.min(width, height)
    for (const target of snapshot.targets) {
      const life = Math.max(0, Math.min(1, (target.expiresAtMs - snapshot.tMs) / GAME.TARGET_LIFETIME_MS))
      const cx = target.x * width
      const cy = target.y * height
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
      const cx = snapshot.aim.x * width
      const cy = snapshot.aim.y * height
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
      if (requestedMode() === 'mock') startMock()
      else startVision()
    },

    unmount(): void {
      ended = true
      window.removeEventListener('keydown', onKeyDown)
      engine?.stop()
      engine = null
      mock?.dispose()
      mock = null
      stopVision()
      root.remove()
    },
  }
}
