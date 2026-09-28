/**
 * Панель признаков (SPEC §9): сырые числа, по которым работают подсказки.
 *
 * Зачем она в интерфейсе, а не только в отладчике: без неё режим «ошибка» невозможно
 * проверить — не видно, что игра действительно измеряет, а не угадывает. Смотрит панель
 * строго в `HandFrame.features` из контракта, своих расчётов не держит.
 *
 * Числа печатаются через `formatValue` — тот же формат, что в подсказках и HUD,
 * иначе в интерфейсе появилась бы третья копия правил форматирования.
 */

import { formatValue } from '../shared/diagnostics'
import type { FrameInput } from '../shared/types'
import { el, labeledLine, type Line } from './dom'

export interface FeaturePanel {
  readonly root: HTMLElement
  update(frame: FrameInput): void
}

export function createFeaturePanel(): FeaturePanel {
  const root = el('div', 'features')
  root.append(el('div', 'features__title', 'Признаки (debug)'))

  const hand = labeledLine('рука', 'features__row')
  const fistScore = labeledLine('fistScore', 'features__row')
  const openPalmScore = labeledLine('openPalmScore', 'features__row')
  const thumbExtension = labeledLine('thumbExtension', 'features__row')
  const palmFrontality = labeledLine('palmFrontality', 'features__row')
  const palmWidthRatio = labeledLine('palmWidthRatio', 'features__row')
  const palmRoll = labeledLine('palmRoll', 'features__row')
  const opening = labeledLine('раскрытие', 'features__row')
  const curls = labeledLine('сгибы пальцев', 'features__row')

  const rows: readonly Line[] = [
    hand,
    fistScore,
    openPalmScore,
    thumbExtension,
    palmFrontality,
    palmWidthRatio,
    palmRoll,
    opening,
    curls,
  ]
  for (const row of rows) root.append(row.root)

  function update(frame: FrameInput): void {
    const first = frame.hands[0]
    if (first === undefined) {
      for (const row of rows) row.set('—')
      return
    }

    const features = first.features
    hand.set(first.handedness)
    fistScore.set(formatValue(features.fistScore, 'ratio'))
    openPalmScore.set(formatValue(features.openPalmScore, 'ratio'))
    thumbExtension.set(formatValue(features.thumbExtension, 'ratio'))
    palmFrontality.set(formatValue(features.palmFrontality, 'ratio'))
    palmWidthRatio.set(formatValue(features.palmWidthRatio, 'ratio'))
    palmRoll.set(formatValue(features.palmRollDeg, 'deg'))
    opening.set(
      features.openingSpeedMs === null ? '—' : formatValue(features.openingSpeedMs, 'ms'),
    )
    curls.set(features.fingerCurlDeg.map((angle) => Math.round(angle)).join(' / '))
  }

  return { root, update }
}
