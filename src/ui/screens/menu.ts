/**
 * Экран MENU: что за игра, какие жесты, как начать раунд.
 * Список жестов — тот же, что в README и docs/TWIST.md (5 жестов).
 */

import { button, el } from '../dom'
import type { AppContext, Screen } from '../router'

const GESTURES: ReadonlyArray<readonly [string, string]> = [
  ['☝️ Указательный палец', 'прицел следует за кончиком пальца'],
  ['👍 Большой палец в позе прицела', 'выстрел: отведён — готов (ARMED), прижат — выстрел'],
  ['🖐 Ладонь плоско к камере', 'щит'],
  ['Наклон корпуса влево/вправо', 'уклонение (через Pose, пока не подключено)'],
  ['🤏 Пинч', 'заморозка времени (бонусный, отложен)'],
]

export function createMenuScreen(ctx: AppContext): Screen {
  const root = el('section', 'screen screen--menu')
  root.append(el('h1', 'title', 'MOTION RANGE'))
  root.append(
    el(
      'p',
      'subtitle',
      'Жестовый тир: веб-камера вместо джойстика. Игра не просто реагирует на жесты — она объясняет, почему жест не распознан, с измеренными числами и порогами.',
    ),
  )

  const gestures = el('div', 'gestures')
  for (const [name, action] of GESTURES) {
    const row = el('div', 'gestures__row')
    row.append(el('span', 'gestures__name', name), el('span', 'gestures__action', action))
    gestures.append(row)
  }
  root.append(gestures)

  const actions = el('div', 'actions')
  actions.append(
    button('Калибровка и в бой', () => ctx.go('CALIBRATE')),
    button('Пропустить калибровку', () => ctx.go('PLAY'), 'ghost'),
  )
  root.append(actions)

  root.append(
    el(
      'p',
      'note',
      'Камера уже подключена: наведи указательный палец — прицел пойдёт за кончиком. Отведи большой палец — рука готова к выстрелу, прижми его — выстрел (поза прицела при этом не срывается). Щит ладонью и персональные подсказки подключаются следующими шагами. Если камера недоступна, играется мок-ввод: добавь ?input=mock к адресу.',
    ),
  )

  return {
    id: 'MENU',
    mount(host: HTMLElement): void {
      host.append(root)
    },
    unmount(): void {
      root.remove()
    },
  }
}
