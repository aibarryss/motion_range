/**
 * Общие правила работы с диагностиками (SPEC §3, §5).
 *
 * Зачем это в shared, а не в UI: подсказки обязаны показывать числа из MetricReading.
 * Если каждый экран (HUD, Signal Doctor, финал) форматирует значения сам,
 * появляется вторая копия порогов — та самая «каша», из-за которой текст
 * расходится со SPEC. Здесь только две примитивные операции:
 *   · какая диагностика главная;
 *   · как напечатать значение.
 * Формулировки (message/hint) и шкала «34% → 78%» остаются за UI.
 *
 * Числа печатаются с точкой (0.31), как в таблицах SPEC — единый вид во всех экранах.
 */

import { SEVERITY_ORDER } from './consts'
import type { Diagnostic, MetricUnit } from './types'

/**
 * Диагностика, которую показывают Signal Doctor и HUD: самая severe,
 * при равной severity — первая в списке (порядок vision детерминирован).
 */
export function primaryDiagnostic(list: readonly Diagnostic[]): Diagnostic | null {
  let best: Diagnostic | null = null
  for (const d of list) {
    if (best === null || SEVERITY_ORDER[d.severity] < SEVERITY_ORDER[best.severity]) best = d
  }
  return best
}

/** Печать измеренного значения и порога в одном формате на всех экранах. */
export function formatValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'ratio':
      return value.toFixed(2)
    case 'deg':
      return `${Math.round(value)}°`
    case 'ms':
      return `${Math.round(value)} мс`
    case 'luma':
      return `${Math.round(value)}`
    case 'fps':
      return value.toFixed(1)
    case 'points':
      return `${Math.round(value)}`
  }
}
