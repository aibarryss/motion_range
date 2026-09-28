/**
 * Замороженный контракт между Vision (A) и Game (B).
 * После тега v0.1-contract меняется только вдвоём, через PR в src/shared/**.
 */

export type Gesture = 'AIM' | 'SHOOT' | 'SHIELD' | 'NONE';

export type DiagnosticCode =
  | 'NO_HAND'
  | 'HAND_OFFSCREEN'
  | 'TOO_CLOSE'
  | 'TOO_FAR'
  | 'TOO_DARK'
  | 'LOW_CONFIDENCE'
  | 'THUMB_OUT'
  | 'PALM_ROLL'
  | 'PALM_EDGE'
  | 'SHOOT_TOO_SLOW'
  | 'SLOW_FPS';

export type DiagnosticSeverity = 'info' | 'warn' | 'block';

export interface HandFrame {
  gesture: Gesture;
  handedness: 'L' | 'R';
  /** 0..1, экранные координаты прицела (уже зеркальные) */
  x: number;
  y: number;
  /** 0..1, уверенность трекера */
  confidence: number;
}

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  /** что не так */
  message: string;
  /** что сделать */
  hint: string;
  /** измеренное значение для подсказки «с числами», опционально */
  measured?: number;
}

/** Состояние игрока от PoseLandmarker (уклонение). Заглушки = 0, если Pose выключен. */
export interface PlayerFrame {
  /** -1..1, наклон корпуса влево/вправо от персонального baseline */
  leanX: number;
  /** 0..1, приседание (резерв) */
  duck: number;
}

/** Единица потока Vision → Game. Игра читает только этот объект. */
export interface FrameInput {
  hands: HandFrame[]; // 0..2
  player: PlayerFrame;
  diagnostics: Diagnostic[];
  fps: number;
}

/** События-импульсы (не состояния): выстрел и щит приходят как факты на кадре. */
export interface VisionEvents {
  /** true ровно на кадре срабатывания выстрела */
  shoot: boolean;
  /** рука-щит активна на этом кадре */
  shield: boolean;
}
