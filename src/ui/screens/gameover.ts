/**
 * Экран GAMEOVER: итог раунда и отчёт по осям.
 *
 * Отчёт «Gesture Readiness Report» (SPEC §7) требует данных о жестах — он появится
 * вместе со слоем vision. Сейчас честно показано, что измерять пока нечего,
 * а не выдуманные проценты.
 */

import { button, el, labeledLine } from '../dom'
import type { AppContext, Screen } from '../router'

const AXES: readonly string[] = ['Aim', 'Release', 'Shield', 'Visibility']

export function createGameOverScreen(ctx: AppContext): Screen {
  const result = ctx.lastResult
  const root = el('section', 'screen screen--final')

  if (result === null) {
    root.append(el('h2', 'section-title', 'Раунд ещё не сыгран'))
    root.append(el('p', 'note', 'Финальный экран открывается после раунда.'))
    const back = el('div', 'actions')
    back.append(button('В меню', () => ctx.go('MENU')))
    root.append(back)
    return {
      id: 'GAMEOVER',
      mount(host: HTMLElement): void {
        host.append(root)
      },
      unmount(): void {
        root.remove()
      },
    }
  }

  root.append(el('h2', 'section-title', 'Раунд окончен'))
  root.append(el('p', 'score-big', String(result.score)))

  const stats = el('div', 'stats')
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['выстрелов', String(result.shots)],
    ['попаданий', String(result.hits)],
    ['промахов', String(result.misses)],
    ['мишеней упущено', String(result.expired)],
    ['точность', `${Math.round(result.accuracy * 100)}%`],
    ['длительность', `${Math.round(result.durationMs / 1000)} с`],
  ]
  for (const [label, value] of rows) {
    const line = labeledLine(label, 'line')
    line.set(value)
    stats.append(line.root)
  }
  root.append(stats)

  root.append(el('h3', 'section-title', 'Gesture Readiness Report'))
  const axes = el('div', 'stats')
  for (const axis of AXES) {
    const line = labeledLine(axis, 'line')
    line.set('—')
    axes.append(line.root)
  }
  root.append(axes)
  root.append(
    el(
      'p',
      'note',
      'Оси Aim / Release / Shield / Visibility считаются по кадрам распознавания (SPEC §7). Пока жесты приходят от мока, измерять нечего — отчёт включится вместе с камерой.',
    ),
  )

  const actions = el('div', 'actions')
  actions.append(
    button('Ещё раз', () => ctx.go('PLAY')),
    button('В меню', () => ctx.go('MENU'), 'ghost'),
  )
  root.append(actions)

  return {
    id: 'GAMEOVER',
    mount(host: HTMLElement): void {
      host.append(root)
    },
    unmount(): void {
      root.remove()
    },
  }
}
