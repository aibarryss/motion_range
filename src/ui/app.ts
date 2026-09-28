/**
 * Сборка приложения.
 *
 * Единственное место, где решается, какой источник кадров играет:
 * сейчас `createKeyboardMockSource` внутри экрана PLAY, после задачи «vision» — реальный.
 * Больше никакой подготовки DOM тут нет: `main.ts` только находит контейнер.
 */

import { Router, type AppContext } from './router'
import { createCalibrateScreen } from './screens/calibrate'
import { createGameOverScreen } from './screens/gameover'
import { createMenuScreen } from './screens/menu'
import { createPlayScreen } from './screens/play'

export interface App {
  readonly ctx: AppContext
  start(): void
}

export function createApp(host: HTMLElement): App {
  const router = new Router(host, {
    MENU: createMenuScreen,
    CALIBRATE: createCalibrateScreen,
    PLAY: createPlayScreen,
    GAMEOVER: createGameOverScreen,
  })
  return {
    ctx: router.ctx,
    start: (): void => {
      router.go('MENU')
    },
  }
}
