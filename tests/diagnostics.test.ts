import { describe, expect, it } from 'vitest'
import { formatValue, primaryDiagnostic } from '../src/shared/diagnostics'
import type { Diagnostic, DiagnosticSeverity, MetricUnit } from '../src/shared/types'
import { sampleDiagnostic } from './fixtures/frame-input.example'

/** Диагностика с заданной severity — остальные поля берём из фикстуры. */
function withSeverity(severity: DiagnosticSeverity, code: Diagnostic['code']): Diagnostic {
  return { ...sampleDiagnostic, severity, code }
}

describe('primaryDiagnostic — ровно одна диагностика для HUD и Signal Doctor (SPEC §5)', () => {
  it('у пустого списка главной нет', () => {
    expect(primaryDiagnostic([])).toBeNull()
  })

  it('выбирает самую severe независимо от порядка в списке', () => {
    const info = withSeverity('info', 'SLOW_FPS')
    const warn = withSeverity('warn', 'THUMB_OUT')
    const block = withSeverity('block', 'NO_HAND')

    expect(primaryDiagnostic([info, warn, block])?.code).toBe('NO_HAND')
    expect(primaryDiagnostic([block, warn, info])?.code).toBe('NO_HAND')
    expect(primaryDiagnostic([warn, info])?.code).toBe('THUMB_OUT')
    expect(primaryDiagnostic([info, warn])?.code).toBe('THUMB_OUT')
  })

  it('при равной severity остаётся первая — результат детерминирован', () => {
    const first = withSeverity('warn', 'PALM_EDGE')
    const second = withSeverity('warn', 'PALM_ROLL')
    expect(primaryDiagnostic([first, second])?.code).toBe('PALM_EDGE')
    expect(primaryDiagnostic([second, first])?.code).toBe('PALM_ROLL')
  })

  it('не мутирует входной список', () => {
    const list = [withSeverity('info', 'SLOW_FPS'), withSeverity('block', 'TOO_DARK')]
    primaryDiagnostic(list)
    expect(list[0].code).toBe('SLOW_FPS')
  })
})

describe('formatValue — одинаковые числа на всех экранах (SPEC §3)', () => {
  const cases: Array<[number, MetricUnit, string]> = [
    [0.31, 'ratio', '0.31'],
    [45.4, 'deg', '45°'],
    [699.6, 'ms', '700 мс'],
    [142.4, 'luma', '142'],
    [29.84, 'fps', '29.8'],
    [3.2, 'points', '3'],
  ]

  it.each(cases)('%s %s → %s', (value, unit, expected) => {
    expect(formatValue(value, unit)).toBe(expected)
  })
})
