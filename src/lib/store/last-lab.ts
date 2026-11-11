"use client";

/**
 * Where the visitor last was in the lab: the datasets, or one of them.
 * The Lab tab leads back there, so leaving for another page and returning
 * lands on the same dataset, in the state it was left (the lab's store
 * stays in memory while the tab is open). Kept for the session, so a
 * reload remembers the place too.
 */
import { useSyncExternalStore } from "react";

const KEY = "ragui.lab";
const START = "/lab";

let last: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  if (last !== null) return last;
  last = START;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored?.startsWith(START)) last = stored;
  } catch {
    // Storage unavailable: the place is remembered for as long as the page lives.
  }
  return last;
}

export function rememberLab(path: string) {
  if (read() === path) return;
  last = path;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Not kept past this page.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The address the Lab tab should lead to. `/lab` on the server and until the page has hydrated. */
export function useLastLab(): string {
  return useSyncExternalStore(subscribe, read, () => START);
}
