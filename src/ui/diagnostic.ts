/**
 * Диагностика в интерфейсе: панель Signal Doctor и карточка полного ответа.
 *
 * Здесь НЕТ чисел. Значение, порог, единица, направление сравнения и личная норма
 * приходят в `Diagnostic.metric` и печатаются через `formatValue` из
 * `src/shared/diagnostics.ts` — второй копии порогов в UI не заводится (SPEC §3.1).
 * Поэтому подсказка всегда называет измеренное значение и порог, а не просто совет.
 */

import { formatValue } from '../shared/diagnostics'
import type { Comparator, Diagnostic, DiagnosticCode, MetricReading } from '../shared/types'
import { el, labeledLine, type Line } from './dom'

export type DoctorIndicator = 'handVisible' | 'palmFacing' | 'fingersOpen' | 'motionSpeed'

export const DOCTOR_ORDER: readonly DoctorIndicator[] = [
  'handVisible',
  'palmFacing',
  'fingersOpen',
  'motionSpeed',
]

export const DOCTOR_LABELS: Record<DoctorIndicator, string> = {
  handVisible: 'Hand visible',
  palmFacing: 'Palm facing camera',
  fingersOpen: 'Fingers open',
  motionSpeed: 'Motion speed',
}

/**
 * Какая диагностика зажигает какой индикатор — колонка из SPEC §5.
 * `null` означает «индикатора нет»: дистанция и яркость показываются иначе
 * (TOO_CLOSE/TOO_FAR — контуром ладони, TOO_DARK — затемнением, SLOW_FPS — HUD).
 */
const INDICATOR_BY_CODE: Record<DiagnosticCode, DoctorIndicator | null> = {
  NO_HAND: 'handVisible',
  HAND_OFFSCREEN: 'handVisible',
  LOW_CONFIDENCE: 'handVisible',
  PALM_EDGE: 'palmFacing',
  PALM_ROLL: 'palmFacing',
  THUMB_OUT: 'fingersOpen',
  SHOOT_TOO_SLOW: 'motionSpeed',
  TOO_CLOSE: null,
  TOO_FAR: null,
  TOO_DARK: null,
  SLOW_FPS: null,
}

export function indicatorFor(code: DiagnosticCode): DoctorIndicator | null {
  return INDICATOR_BY_CODE[code]
}

const COMPARATOR_TEXT: Record<Comparator, string> = {
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
}

/** Часть 2 полного ответа: «почему» — измеренное значение, порог и личная норма. */
export function describeMetric(metric: MetricReading): string {
  const baseline =
    metric.baseline === undefined ? '' : ` · твоя норма ${formatValue(metric.baseline, metric.unit)}`
  return `${formatValue(metric.value, metric.unit)} при норме ${COMPARATOR_TEXT[metric.comparator]} ${formatValue(metric.limit, metric.unit)}${baseline}`
}

/** Часть 4 ответа: насколько значение близко к порогу, 0..1 — для шкалы. */
export function metricRatio(metric: MetricReading): number {
  if (metric.limit === 0) return 0
  return Math.max(0, Math.min(1, metric.value / metric.limit))
}

export interface SignalDoctor {
  readonly root: HTMLElement
  update(diagnostic: Diagnostic | null, brightness: number): void
}

export function createSignalDoctor(): SignalDoctor {
  const root = el('div', 'doctor')
  root.append(el('div', 'doctor__title', 'Signal Doctor'))

  const rows = new Map<DoctorIndicator, Line>()
  for (const indicator of DOCTOR_ORDER) {
    const row = labeledLine(DOCTOR_LABELS[indicator], 'doctor__row')
    rows.set(indicator, row)
    root.append(row.root)
  }

  const brightnessBar = el('div', 'doctor__brightness')
  const brightnessFill = el('div', 'doctor__brightness-fill')
  brightnessBar.append(brightnessFill)
  root.append(brightnessBar)

  function update(diagnostic: Diagnostic | null, brightness: number): void {
    const active = diagnostic === null ? null : indicatorFor(diagnostic.code)
    for (const [indicator, row] of rows) {
      const alert = indicator === active
      row.root.classList.toggle('doctor__row--alert', alert)
      row.set(alert && diagnostic !== null ? describeMetric(diagnostic.metric) : '—')
    }
    brightnessFill.style.width = `${Math.round(Math.max(0, Math.min(1, brightness / 255)) * 100)}%`
  }

  return { root, update }
}

export interface DiagnosticCard {
  readonly root: HTMLElement
  update(diagnostic: Diagnostic | null): void
}

/** Полный ответ на ошибку из четырёх частей (SPEC §3): что / почему / что делать / шкала. */
export function createDiagnosticCard(): DiagnosticCard {
  const root = el('div', 'diag')
  const code = el('div', 'diag__code', 'ok')
  const message = el('div', 'diag__message', 'Проблем нет')
  const why = el('div', 'diag__why', 'Все проверки кадра пройдены')
  const bar = el('div', 'diag__bar')
  const fill = el('div', 'diag__bar-fill')
  bar.append(fill)
  const scale = el('div', 'diag__scale')
  const hint = el('div', 'diag__hint')
  root.append(code, message, why, bar, scale, hint)

  function update(diagnostic: Diagnostic | null): void {
    if (diagnostic === null) {
      root.classList.remove('diag--alert')
      code.textContent = 'ok'
      message.textContent = 'Проблем нет'
      why.textContent = 'Все проверки кадра пройдены'
      scale.textContent = ''
      hint.textContent = ''
      fill.style.width = '0%'
      return
    }

    root.classList.add('diag--alert')
    code.textContent = `${diagnostic.code} · ${diagnostic.severity}`
    message.textContent = diagnostic.message
    why.textContent = describeMetric(diagnostic.metric)
    hint.textContent = diagnostic.hint

    const percent = Math.round(metricRatio(diagnostic.metric) * 100)
    fill.style.width = `${percent}%`
    scale.textContent = `${percent}% от порога`
  }

  return { root, update }
}
