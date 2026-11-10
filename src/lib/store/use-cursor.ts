"use client";

import { useSyncExternalStore } from "react";
import { useLab } from "./lab";
import { cursor, INGEST_SLOTS, SLOTS } from "./playhead";

const subscribe = (listener: () => void) => cursor.on("change", listener);

/**
 * A value derived from the cursor, re-rendering only when the value itself
 * changes: the cursor moves every frame, a count of revealed rows does not.
 * `select` must return a primitive (a number, a boolean).
 */
export function useCursor<T extends number | boolean>(select: (position: number) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(cursor.get()),
    () => select(0),
  );
}

/** How many of `total` items a stage has revealed so far: none before its slot, all after it. */
export function useRevealed(slot: number, total: number): number {
  return useCursor((position) => {
    const local = position - slot;
    if (local <= 0) return 0;
    if (local >= 0.85) return total;
    return Math.min(total, Math.ceil((local / 0.85) * total));
  });
}

/**
 * The slot being shown: the one the cursor is inside, or the last finished
 * one when it rests at the end of what has been computed.
 */
export function useCurrentSlot(): number {
  const limit = useLab((state) => state.limit);
  return useCursor((position) => {
    if (position >= limit - 1e-6) return Math.max(0, Math.min(SLOTS.length - 1, Math.ceil(limit) - 1));
    return Math.min(SLOTS.length - 1, Math.floor(position));
  });
}

/** Whether the cursor has entered a slot (true while it plays and after). */
export function useEntered(slot: number): boolean {
  return useCursor((position) => position > slot + 1e-6 || (slot === INGEST_SLOTS && position >= slot));
}

/** Whether the cursor has passed a slot. */
export function usePassed(slot: number): boolean {
  return useCursor((position) => position >= slot + 1 - 1e-6);
}
