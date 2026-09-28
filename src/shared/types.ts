/**
 * Замороженный контракт между Vision (A) и Game (B).
 * Версия: **v0.2** (изменения против v0.1 — в docs/SPEC_Diagnostics_and_Fire.md, §0).
 * После тега v0.2-contract меняется только вдвоём, через PR в src/shared/**.
 *
 * Правило проекта: числа в контракте не хранятся — только пороги из consts.ts,
 * и диагностика обязана нести измеренное значение вместе с порогом (MetricReading).
 */

/** Состояния руки: то, что можно удерживать во времени. */
export type Gesture = 'AIM' | 'SHIELD' | 'FIST' | 'NONE';

export type Handedness = 'L' | 'R';

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

/** Признак из SPEC §1, который можно измерить и сравнить с порогом. */
export type FeatureName =
  | 'fistScore'
  | 'openPalmScore'
  | 'thumbExtension'
  | 'palmFrontality'
  | 'palmWidthRatio'
  | 'palmRollDeg'
  | 'openingSpeedMs'
  | 'brightness'
  | 'handConfidence'
  | 'fps'
  | 'offscreenPoints'
  | 'noHandMs';

export type Comparator = 'lt' | 'lte' | 'gt' | 'gte';

export type MetricUnit = 'ratio' | 'deg' | 'ms' | 'luma' | 'fps' | 'points';

/**
 * Измеренное значение + порог + личная норма.
 * Единственный источник чисел для текста подсказки: UI форматирует эти поля,
 * а не держит собственную таблицу порогов (иначе подсказки расходятся со SPEC).
 */
export interface MetricReading {
  name: FeatureName;
  value: number;
  /** порог из src/shared/consts.ts, соответствующий comparator */
  limit: number;
  comparator: Comparator;
  unit: MetricUnit;
  /** персональная норма из CalibrationProfile (SPEC §4), если калибровка пройдена */
  baseline?: number;
}

/** Подсветка на оверлее скелета — колонка «Подсветка» из SPEC §3. */
export interface Highlight {
  /** индексы landmark 0..20, которые подсветить */
  points?: number[];
  /** пары индексов, которые подсветить линией (например [5, 17] — линия ладони) */
  edges?: Array<[number, number]>;
  /** рамка кадра (NO_HAND) */
  frame?: boolean;
  /** затемнить оверлей (TOO_DARK) */
  dim?: boolean;
}

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  /** Часть 1 полного ответа: что произошло. */
  message: string;
  /** Часть 3: что сделать. */
  hint: string;
  /** Часть 2 («почему», с числами) и часть 4 (шкала) строятся UI из этого. */
  metric: MetricReading;
  /** Какую руку подсвечиваем. */
  handedness?: Handedness;
  /** Что именно подсветить на скелете. */
  highlight?: Highlight;
}

/** Признаки одного кадра для debug-панели, отчёта и реплей-харнесса (SPEC §1, §9). */
export interface HandFeatures {
  /**
   * Геометрия пальцев без участия большого пальца (v0.2).
   * Почему без большого: правило THUMB_OUT проверяет отведённый палец,
   * а если thumbExtension входит в fistScore — правило становится недостижимым.
   */
  fistScore: number;
  openPalmScore: number;
  /** |landmark[4] − landmark[5]| / W, W = ширина ладони. */
  thumbExtension: number;
  /** W_2d / W_3d: 1 — ладонь к камере, < 0.5 — ребром. */
  palmFrontality: number;
  /** W в пикселях / ширина кадра — прокси дистанции. */
  palmWidthRatio: number;
  palmRollDeg: number;
  /** мс на текущий переход кулак→ладонь; null — перехода нет. */
  openingSpeedMs: number | null;
  /** углы в PIP для указательного, среднего, безымянного, мизинца. */
  fingerCurlDeg: [number, number, number, number];
}

export interface HandFrame {
  gesture: Gesture;
  handedness: Handedness;
  /** 0..1, экранные координаты прицела (уже зеркальные) */
  x: number;
  y: number;
  /** 0..1, уверенность трекера */
  confidence: number;
  /** Признаки кадра — источник для debug-панели, отчёта и подсказок с числами. */
  features: HandFeatures;
}

/** Состояние игрока от PoseLandmarker (уклонение). Заглушки = 0, если Pose выключен. */
export interface PlayerFrame {
  /** -1..1, наклон корпуса влево/вправо от персонального baseline */
  leanX: number;
  /** 0..1, приседание (резерв) */
  duck: number;
}

/**
 * События-импульсы: только то, что нельзя удержать во времени.
 * Щит — это состояние руки (Gesture 'SHIELD'), а не событие.
 */
export interface VisionEvents {
  /**
   * true ровно на кадре срабатывания выстрела.
   * Источник не важен потребителю: динамический жест, пинч-фолбэк или Space в debug-режиме
   * (SPEC §2) — всё приходит этим флагом.
   */
  shoot: boolean;
}

/** Метрики кадра для HUD (SPEC §6). */
export interface FrameMetrics {
  /** fps камеры */
  cameraFps: number;
  /** fps тика распознавания */
  detectFps: number;
  /** fps трекинга позы; null — Pose выключен (облегчённый режим) */
  poseFps: number | null;
  /** камера → признаки, мс (HUD «round-trip») */
  latencyMs: number;
  /** 0..255, средняя luma bbox руки; при отсутствии руки — всего кадра */
  brightness: number;
}

/** Персональный baseline из калибровки (SPEC §4). Хранится в localStorage. */
export interface CalibrationProfile {
  /** Первый формат профиля калибровки; версия профиля не связана с версией контракта. */
  version: 1;
  /** стабильная зона ладони: медиана ± коридор */
  palmWidthRatioStable: { min: number; max: number };
  /** личная норма большого пальца в кулаке */
  thumbExtensionCalm: number;
  /** личный темп раскрытия кулака, мс */
  openDurationPersonalMs: number;
  brightnessBaseline: number;
  dominantHand: Handedness;
  /** нейтральное положение плеч и комфортный наклон (Pose) */
  leanNeutral: number;
  dodgeRange: number;
  /** performance.now() момента сохранения */
  createdAtMs: number;
}

/** Единица потока Vision → Game. Игра читает только этот объект. */
export interface FrameInput {
  /** performance.now() момента готовности кадра — для логов, задержек и реплея */
  tMs: number;
  hands: HandFrame[]; // 0..2
  player: PlayerFrame;
  events: VisionEvents;
  /** Отсортированы по приоритету: block → warn → info (SPEC §3.1). */
  diagnostics: Diagnostic[];
  metrics: FrameMetrics;
  /** null — калибровка не пройдена, подсказки без персональных норм. */
  calibration: CalibrationProfile | null;
}
