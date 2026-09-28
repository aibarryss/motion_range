/**
 * Роутер экранов: MENU → CALIBRATE → PLAY → GAMEOVER.
 *
 * Переход сам снимает текущий экран и монтирует следующий, поэтому экраны
 * не знают друг о друге и не держат ссылок на чужие узлы DOM.
 * Результат раунда живёт в контексте роутера (`lastResult`) — так финальный экран
 * получает цифры, не пролезая в движок напрямую.
 */

import type { RoundResult } from '../game/engine'

export type ScreenId = 'MENU' | 'CALIBRATE' | 'PLAY' | 'GAMEOVER'

export interface AppContext {
  go(id: ScreenId): void
  /** результат последнего раунда; null — ещё не играли */
  lastResult: RoundResult | null
}

export interface Screen {
  readonly id: ScreenId
  mount(host: HTMLElement): void
  unmount(): void
}

export type ScreenFactory = (ctx: AppContext) => Screen

export class Router {
  readonly ctx: AppContext

  private current: Screen | null = null
  private readonly host: HTMLElement
  private readonly factories: Record<ScreenId, ScreenFactory>

  constructor(host: HTMLElement, factories: Record<ScreenId, ScreenFactory>) {
    this.host = host
    this.factories = factories
    this.ctx = {
      go: (id: ScreenId) => {
        this.go(id)
      },
      lastResult: null,
    }
  }

  get currentId(): ScreenId | null {
    return this.current === null ? null : this.current.id
  }

  go(id: ScreenId): void {
    this.current?.unmount()
    this.host.replaceChildren()
    const screen = this.factories[id](this.ctx)
    this.current = screen
    screen.mount(this.host)
  }
}
