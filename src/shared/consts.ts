/**
 * Все пороги в одном месте (docs/SPEC_Diagnostics_and_Fire.md).
 * Подбираются на реплей-харнессе, правятся только здесь.
 */

// --- нормализация: все признаки в единицах ширины ладони W = |lm[5] - lm[17]| ---

export const THUMB = {
  FIST_MAX: 0.18, // в кулаке thumbExtension < 0.18
  OUT_MIN: 0.25, // торчит, если > 0.25 (код THUMB_OUT)
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

// --- автомат выстрела (мс) ---

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
