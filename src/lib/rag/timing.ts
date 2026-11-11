import type { Runtime } from "./types";

/** How many steps of the clock a measurement must span to be worth showing. */
const STEPS = 10;
/** Past this many repeats the stage is simply faster than can be told. */
const MAX_RUNS = 4096;

/**
 * Runs a pure function and says how long it took. A browser rounds its
 * clock, and most stages of the pipeline finish in less than one step of
 * it, so one call would read as zero. When the runtime says how coarse its
 * clock is and the call was too short for it, the same call is repeated
 * until the clock has moved enough, and the mean is the duration. That is
 * only sound because the function is pure: every repeat does the same work
 * and returns the same thing. The value returned is the first call's.
 */
export function timed<T>(runtime: Runtime, run: () => T): { value: T; ms: number } {
  const start = runtime.now();
  const value = run();
  let elapsed = runtime.now() - start;
  const enough = (runtime.resolution ?? 0) * STEPS;
  let runs = 1;
  let batch = 1;
  while (elapsed < enough && runs < MAX_RUNS) {
    for (let i = 0; i < batch; i++) run();
    runs += batch;
    batch = Math.max(1, Math.min(batch * 2, MAX_RUNS - runs));
    elapsed = runtime.now() - start;
  }
  return { value, ms: elapsed / runs };
}
