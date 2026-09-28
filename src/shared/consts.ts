/**
 * Все пороги в одном месте (единственный источник чисел для кода).
 * Текстовое описание и условия правил — docs/SPEC_Diagnostics_and_Fire.md.
 * Порядок изменения порога: SPEC → тест заморозки → эта константа.
 *
 * Версия: v0.2 (правка большого пальца, см. THUMB и SPEC §0).
 */

import type { DiagnosticSeverity, HandFeatures } from './types'

// --- нормализация: все признаки в единицах ширины ладони W = |lm[5] - lm[17]| ---

export const THUMB = {
  /** В правильном кулаке thumbExtension < 0.18. Это же число звучит в подсказке THUMB_OUT. */
  TARGET_MAX_FIST: 0.18,
  /** thumbExtension > 0.25 при собранных пальцах → диагностика THUMB_OUT. */
  OUT_MIN: 0.25,
  /**
   * Правило THUMB_OUT смотрит на fistScore без учёта большого пальца (v0.2)
   * и требует собранные пальцы: fistScore ≥ 0.6.
   * В v0.1 thumbExtension входил в fistScore, поэтому правило было недостижимо.
   */
  OUT_FIST_SCORE_MIN: 0.6,
} as const;

export const PALM = {
  FRONT: 0.7, // palmFrontality > 0.7 — ладонь к камере (щит)
  EDGE: 0.5, // < 0.5 — ребром (код PALM_EDGE)
  ROLL_MAX_DEG: 45, // palmRoll > 45° — код PALM_ROLL
  WIDTH_CLOSE: 0.42, // palmWidthRatio > — код TOO_CLOSE
  WIDTH_FAR: 0.1, // palmWidthRatio < — код TOO_FAR
} as const;

export const FINGER = {
  CURLED_MAX_DEG: 150, // угол PIP < 150° — согнут
  STRAIGHT_MIN_DEG: 165, // угол PIP > 165° — разогнут
  TIP_TO_PALM: 0.6, // tip→palmCenter < 0.6·W — прижат к ладони
  WRIST_TIP: 1.4, // wrist→tip > 1.4·W — палец разогнут (openPalm)
} as const;

export const SCORES = {
  ENTER: 0.8, // порог входа в состояние (fistScore/openPalmScore)
  HOLD: 0.6, // порог удержания (гистерезис)
} as const;

// --- автомат выстрела (мс): IDLE → ARMED → FIRE → COOLDOWN → IDLE ---

export const FIRE = {
  FIST_DWELL_MS: 100, // fistScore > 0.8 держится 80–120 мс → ARMED
  OPEN_DWELL_MS: 60, // openPalmScore > 0.8 держится 50–80 мс → FIRE
  OPEN_WINDOW_MS: 400, // раскрыться нужно в пределах этого окна после ARMED
  COOLDOWN_MS: 250, // один взмах = один выстрел
  TOO_SLOW_MS: 600, // раскрытие дольше — код SHOOT_TOO_SLOW
} as const;

// --- диагностика среды ---

export const ENV = {
  BRIGHTNESS_MIN: 60, // luma < — код TOO_DARK
  CONFIDENCE_MIN: 0.5, // handConfidence < при видимой руке — LOW_CONFIDENCE
  OFFSCREEN_MARGIN: 0.9, // вне центральных 90% кадра — HAND_OFFSCREEN
  OFFSCREEN_POINTS: 3, // ≥3 точек из 21 вне маркета
  NO_HAND_MS: 500, // нет руки дольше — код NO_HAND
  FPS_MIN: 18, // fps < — код SLOW_FPS
} as const;

// --- сглаживание и производительность ---

export const SMOOTH = {
  AIM_EMA: 0.35, // сглаживание прицела (меньше = плавнее)
  GESTURE_DWELL_FRAMES: 3, // жест подтверждается после N подряд кадров
  DETECT_INTERVAL_MS: 33, // тик распознавания ~30 FPS независимо от rAF
} as const;

// --- диагностика: приоритет показа (SPEC §3, §5) ---

/**
 * Signal Doctor и HUD показывают ровно одну диагностику — самую severe.
 * Меньше число = выше приоритет.
 */
export const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  block: 0,
  warn: 1,
  info: 2,
};

/**
 * Нулевой снапшот признаков для мока FrameInput (клавиатурный ввод) и заглушек.
 * Реальный vision обязан заполнять features измеримыми значениями.
 */
export const ZERO_FEATURES: HandFeatures = {
  fistScore: 0,
  openPalmScore: 0,
  thumbExtension: 0,
  palmFrontality: 0,
  palmWidthRatio: 0,
  palmRollDeg: 0,
  openingSpeedMs: null,
  fingerCurlDeg: [0, 0, 0, 0],
};

// --- параметры игрового раунда (игровой баланс, а не пороги распознавания) ---

/**
 * Числа раунда живут здесь по правилу проекта «числа — только в SPEC и consts.ts»:
 * SPEC_Diagnostics_and_Fire.md описывает распознавание и диагностику,
 * баланс раунда — только тут. Движок и экраны читают отсюда, своих копий не держат.
 */
export const GAME = {
  ROUND_MS: 60_000, // длительность раунда
  TARGET_LIFETIME_MS: 2_600, // сколько мишень живёт до «просрочки»
  TARGET_RADIUS_MIN: 0.055, // радиус мишени, доля меньшей стороны сцены
  TARGET_RADIUS_MAX: 0.095,
  SPAWN_INTERVAL_MIN_MS: 550, // пауза между появлениями мишеней
  SPAWN_INTERVAL_MAX_MS: 1_100,
  MAX_TARGETS: 3, // одновременно на экране
  PLAYFIELD_MARGIN: 0.12, // отступ от краёв, чтобы мишени не липли к рамке
  HIT_RADIUS_FACTOR: 1.15, // попадание = прицел ближе радиуса × 1.15
  SCORE_HIT: 10,
  SCORE_MISS: -2, // выстрел в пустоту
  SCORE_EXPIRED: -1, // мишень не успели сбить
  SCORE_FLOOR: 0, // счёт не уходит ниже нуля
} as const;
