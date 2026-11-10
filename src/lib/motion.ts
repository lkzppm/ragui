/**
 * The house springs. Critically damped by default: things arrive without
 * overshoot and can be re-targeted mid-flight, so nothing has to finish
 * before the next thing starts. Bounce only where a motion carries
 * momentum (something dropped, thrown or snapped into place).
 */
export const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;
export const SPRING_FAST = { type: "spring", bounce: 0, duration: 0.25 } as const;
export const SPRING_SLOW = { type: "spring", bounce: 0, duration: 0.7 } as const;
export const SPRING_DROP = { type: "spring", bounce: 0.25, duration: 0.5 } as const;

/** For values that are not positions: fades and colour. */
export const FADE = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
