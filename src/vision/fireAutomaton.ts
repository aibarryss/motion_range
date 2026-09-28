/**
 * Автомат выстрела (SPEC §2).
 *
 * Механика (решение от 28.09.2026): прицел — указательный палец, курок — большой палец.
 * Рука целится с отведённым большим пальцем → **ARMED** (рука готова). Игрок прижимает
 * палец → **FIRE**. Дальше **COOLDOWN**, чтобы один прижим не давал очередь.
 *
 * Почему так лучше прежнего «кулак → резкое раскрытие»: прицел не срывается на время
 * выстрела — игрок целится и стреляет одной и той же позой, как из пистолета. Поэтому
 * автомат крутится вокруг большого пальца, а не вокруг всей кисти.
 *
 * Гистерезис: палец считается отведённым при `THUMB.EXTENDED_MIN_DEG`, прижатым — при
 * `THUMB.TUCKED_MAX_DEG`. Пока значение держится между порогами, решение не меняется —
 * иначе значение на границе давало бы очередь выстрелов.
 *
 * Палец, прижатый всё время, выстрела не даёт: сначала нужно показать готовность
 * (отвести палец) — это и есть «перезарядка» жеста.
 */

import { FIRE, THUMB } from '../shared/consts'
import type { FireState } from '../shared/types'

export interface FireInput {
  /** Рука в позе прицела: указательный вытянут, остальные поджаты. */
  aiming: boolean
  /**
   * Признак `thumbIndexDeg`: угол между большим и указательным пальцем в градусах.
   * Малый угол — палец идёт вдоль указательного (курок нажат), большой — палец отведён.
   * null — руки нет.
   */
  thumbIndexDeg: number | null
  nowMs: number
}

export interface FireDecision {
  state: FireState
  /** true ровно на кадре выстрела: игровой слой узнаёт о выстреле только отсюда. */
  shoot: boolean
  /** Сколько длится текущее состояние, мс. */
  heldMs: number
}

export interface FireAutomaton {
  update(input: FireInput): FireDecision
  reset(): void
}

export function createFireAutomaton(): FireAutomaton {
  let state: FireState = 'IDLE'
  let stateSinceMs = 0
  /** Латч «палец отведён»: в зоне между порогами держим прежнее решение (гистерезис). */
  let latchedExtended = false
  /**
   * Момент начала нажатия, мс; null — нажатия нет.
   * Отдельная переменная, а не «когда латч упал»: при потере руки латч тоже падает,
   * и без этого условия пропажа руки дотягивала бы нажатие до выстрела.
   */
  let pullStartedMs: number | null = null
  let started = false
  /** Момент выстрела: пауза отсчитывается от него, а не от следующего обновления автомата. */
  let firedAtMs = 0

  function enter(next: FireState, nowMs: number, enteredAtMs = nowMs): void {
    if (next === state) return
    state = next
    stateSinceMs = enteredAtMs
  }

  function latch(input: FireInput): void {
    const thumb = input.thumbIndexDeg

    // руки нет или рука не в позе прицела: ни готовности, ни нажатия
    if (thumb === null || !input.aiming) {
      latchedExtended = false
      pullStartedMs = null
      return
    }

    if (thumb > THUMB.EXTENDED_MIN_DEG) {
      latchedExtended = true
      pullStartedMs = null
      return
    }

    if (thumb < THUMB.TUCKED_MAX_DEG && latchedExtended) {
      latchedExtended = false
      pullStartedMs = input.nowMs
    }
    // значение между порогами: держим прежнее решение (гистерезис)
  }

  function update(input: FireInput): FireDecision {
    if (!started) {
      started = true
      stateSinceMs = input.nowMs
    }

    latch(input)

    let shoot = false

    switch (state) {
      case 'IDLE':
        if (input.aiming && latchedExtended) enter('ARMED', input.nowMs)
        break

      case 'ARMED': {
        const readyHeld = input.nowMs - stateSinceMs >= FIRE.READY_DWELL_MS
        if (!input.aiming) {
          enter('IDLE', input.nowMs)
          break
        }
        if (!latchedExtended) {
          // руки нет или поза сломалась — нажатия нет, готовность сбрасываем
          if (pullStartedMs === null || !readyHeld) {
            enter('IDLE', input.nowMs)
            break
          }
          if (input.nowMs - pullStartedMs >= FIRE.PULL_DWELL_MS) {
            shoot = true
            firedAtMs = input.nowMs
            enter('FIRE', input.nowMs)
          }
        }
        break
      }

      case 'FIRE':
        // импульс отдан на прошлом кадре, состояние живёт один кадр.
        // Пауза считается от момента выстрела: на медленной камере между кадрами
        // автомата проходит до 125 мс, и отсчёт «от следующего кадра» растягивал бы паузу.
        enter('COOLDOWN', input.nowMs, firedAtMs)
        break

      case 'COOLDOWN':
        if (input.nowMs - stateSinceMs >= FIRE.COOLDOWN_MS) {
          enter(input.aiming && latchedExtended ? 'ARMED' : 'IDLE', input.nowMs)
        }
        break
    }

    return { state, shoot, heldMs: Math.max(0, input.nowMs - stateSinceMs) }
  }

  return {
    update,
    reset(): void {
      state = 'IDLE'
      latchedExtended = false
      pullStartedMs = null
      started = false
      stateSinceMs = 0
    },
  }
}
