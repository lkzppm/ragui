/**
 * Where a replay stands. The pipeline is thirteen slots in a row (dense and
 * keyword search share one); `cursor` is a position along them, a slot's
 * number plus how far into it. It is a motion value, so views can follow
 * it every frame without React rendering every frame. This is the only
 * animation state there is: everything drawn derives from a trace and it.
 */
import { motionValue } from "motion/react";
import { RAIL } from "@/lib/rag/stages";
import type { StageId } from "@/lib/rag/types";

export const SLOTS: readonly (readonly StageId[])[] = [...RAIL.ingest, ...RAIL.query];
export const INGEST_SLOTS = RAIL.ingest.length;

/** Seconds a slot takes to play at 1×. */
export const SLOT_SECONDS = 1.1;

export const cursor = motionValue(0);

const SLOT_OF = new Map<StageId, number>();
SLOTS.forEach((stages, slot) => stages.forEach((stage) => SLOT_OF.set(stage, slot)));

export function slotOf(stage: StageId): number {
  return SLOT_OF.get(stage) ?? 0;
}

/** How far the cursor is into a stage's slot: 0 before it, 1 after it. */
export function progressIn(stage: StageId, position: number): number {
  const local = position - slotOf(stage);
  return local < 0 ? 0 : local > 1 ? 1 : local;
}
