/**
 * Камера: получить видеопоток и понятную причину, если не получилось.
 *
 * Единственное место в проекте, где вызывается `getUserMedia`. Дальше по коду камера —
 * это просто `HTMLVideoElement`. Ошибки переводим в человеческий текст заранее: на защите
 * «камера не включилась» должно превращаться в конкретную причину, а не в пустой экран.
 */

export type CameraErrorKind = 'unsupported' | 'denied' | 'no-camera' | 'busy' | 'unknown'

export class CameraError extends Error {
  readonly kind: CameraErrorKind

  constructor(message: string, kind: CameraErrorKind) {
    super(message)
    this.name = 'CameraError'
    this.kind = kind
  }
}

export interface Camera {
  readonly video: HTMLVideoElement
  /** Остановить поток и отпустить камеру. */
  stop(): void
}

/** Ограничения потока: 640×480 — как в облегчённом режиме SPEC §9, хватает для 21 точки. */
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30 },
    facingMode: 'user',
  },
}

export async function startCamera(): Promise<Camera> {
  if (navigator.mediaDevices === undefined || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    throw new CameraError(
      'Браузер не даёт доступ к камере на этой странице. Нужен адрес по HTTPS или localhost.',
      'unsupported',
    )
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
  } catch (error) {
    throw toCameraError(error)
  }

  const video = document.createElement('video')
  video.className = 'play__video'
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  video.autoplay = true

  await waitForMetadata(video)
  try {
    await video.play()
  } catch {
    // Автовоспроизведение может быть заблокировано — распознавание работает и по
    // кадрам, которые камера уже отдаёт; видео просто начнёт играть после первого касания.
  }

  return {
    video,
    stop(): void {
      for (const track of stream.getTracks()) track.stop()
      video.srcObject = null
    },
  }
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve()
  return new Promise((resolve) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
  })
}

function toCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError(
        'Доступ к камере запрещён. Нажми на замок в адресной строке и разреши камеру для этого сайта.',
        'denied',
      )
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraError('Камера не найдена. Проверь, что она подключена и видна системе.', 'no-camera')
    case 'NotReadableError':
    case 'AbortError':
      return new CameraError(
        'Камера занята другим приложением. Закрой Zoom/Telegram/другую вкладку с камерой и попробуй снова.',
        'busy',
      )
    default:
      return new CameraError('Камеру не удалось включить по неизвестной причине.', 'unknown')
  }
}
