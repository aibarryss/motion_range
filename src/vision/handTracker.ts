/**
 * Распознавание руки: 21 точка × до 2 рук (MediaPipe HandLandmarker).
 *
 * Модель и wasm-рантайм лежат в `public/` и грузятся с нашего же сайта — на защите
 * приложение не зависит от доступности CDN.
 *
 * Решение по делегату: сначала пробуем GPU, при неудаче молча переходим на CPU.
 * GPU быстрее, но на чужом ноутбуке может не подняться (нет WebGL2, старый драйвер),
 * и падать из-за этого на демо нельзя.
 */

import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface DetectedHand {
  /** 21 точка; 0 — запястье, 4 — большой палец, 8 — указательный, 20 — мизинец. */
  landmarks: NormalizedLandmark[]
  /**
   * Рука так, как её видит человек в зеркале: 'R' — правая рука игрока.
   *
   * MediaPipe определяет сторону в предположении, что картинка уже зеркальная
   * (селфи-камера). Мы подаём сырой кадр без зеркалирования (зеркалим только показ),
   * поэтому метку разворачиваем. Проверяется за одну секунду: подними правую руку —
   * в кадре должно быть 'R'.
   */
  handedness: 'L' | 'R'
  /** Уверенность трекера в том, что это рука: 0..1. */
  score: number
}

export interface HandTracker {
  /** Распознать руки на текущем кадре видео. Время должно расти от вызова к вызову. */
  detect(video: HTMLVideoElement, timestampMs: number): DetectedHand[]
  close(): void
}

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/models/hand_landmarker.task'

/** Пары точек для отрисовки скелета — та же схема, что в демо MediaPipe. */
export const HAND_CONNECTIONS: ReadonlyArray<{ start: number; end: number }> = HandLandmarker.HAND_CONNECTIONS

export async function createHandTracker(): Promise<HandTracker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)

  const taskOptions = {
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  } as const

  let landmarker: HandLandmarker
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      ...taskOptions,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
    })
  } catch {
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      ...taskOptions,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
    })
  }

  return {
    detect(video: HTMLVideoElement, timestampMs: number): DetectedHand[] {
      const result = landmarker.detectForVideo(video, timestampMs)
      const hands: DetectedHand[] = []
      for (let index = 0; index < result.landmarks.length; index += 1) {
        const landmarks = result.landmarks[index]
        const category = result.handedness[index]?.[0]
        if (landmarks === undefined || category === undefined) continue
        hands.push({
          landmarks,
          handedness: category.categoryName === 'Left' ? 'R' : 'L',
          score: category.score,
        })
      }
      return hands
    },
    close(): void {
      landmarker.close()
    },
  }
}
