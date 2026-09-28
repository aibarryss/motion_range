/**
 * Экран CALIBRATE: четыре шага калибровки из SPEC §4.
 *
 * ЧЕСТНО О СОСТОЯНИИ: измерения пока не подключены — их считает слой vision (камера,
 * признаки, автомат). Сейчас экран показывает, ЧТО именно будет измеряться, и передаёт
 * игрока в раунд. Когда vision появится, шаги начнут заполняться цифрами,
 * а профиль ляжет в `FrameInput.calibration` (src/shared/types.ts).
 */

import { button, el } from '../dom'
import type { AppContext, Screen } from '../router'

const STEPS: ReadonlyArray<readonly [string, string]> = [
  ['Показать открытые ладони', 'стабильная зона кисти: palmWidthRatio_stable'],
  ['Сжать кулак', 'личная норма большого пальца: thumbExtension_calm'],
  ['Сделать тестовое раскрытие', 'личный темп раскрытия: openDurationPersonalMs'],
  ['Наклониться влево и вправо', 'нейтраль плеч и комфортный наклон: leanNeutral, dodgeRange'],
]

export function createCalibrateScreen(ctx: AppContext): Screen {
  const root = el('section', 'screen screen--calibrate')
  root.append(el('h2', 'section-title', 'Калибровка · 15 секунд'))
  root.append(
    el(
      'p',
      'note',
      'Измерения ещё не подключены: их считает слой vision. Ниже — что именно будет измеряться в каждой из четырёх проб, чтобы подсказки говорили не «отойди на 60–80 см», а «кисть занимает 38% кадра против твоей зоны 16–28%».',
    ),
  )

  const steps = el('ol', 'steps')
  for (const [title, saved] of STEPS) {
    const item = el('li')
    item.append(el('strong', undefined, title), el('span', undefined, ` — сохраняем ${saved}`))
    steps.append(item)
  }
  root.append(steps)

  const actions = el('div', 'actions')
  actions.append(
    button('Начать раунд', () => ctx.go('PLAY')),
    button('Назад в меню', () => ctx.go('MENU'), 'ghost'),
  )
  root.append(actions)

  return {
    id: 'CALIBRATE',
    mount(host: HTMLElement): void {
      host.append(root)
    },
    unmount(): void {
      root.remove()
    },
  }
}
