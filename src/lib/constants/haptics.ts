/**
 * Semantic Haptic Pattern Registry
 *
 * All vibration patterns are centralized here. Components should import
 * and use these semantic names instead of raw millisecond values.
 *
 * Per CONTEXT.md: Haptics are mobile-only, no desktop fallback.
 */
export const HAPTIC_PATTERNS = {
  /** Ultra-light tap (10ms) - checkbox toggles, subtle feedback */
  LIGHT: 10,
  /** Medium tap (15ms) - navigation, selection changes */
  MEDIUM: 15,
  /** Standard tap (25ms) - dropdown opens, menu interactions */
  TAP: 25,
  /** Heavy tap (50ms) - drag start/end, swipe actions, confirmations */
  HEAVY: 50,
  /** Success pattern [10, 50] - task completion, positive actions */
  SUCCESS: [10, 50] as const,
  /** Warning pattern [50, 100, 50] - delete prompts, destructive action warnings */
  WARNING: [50, 100, 50] as const,
} as const;

/** Type for semantic haptic pattern keys */
export type HapticPattern = keyof typeof HAPTIC_PATTERNS;
