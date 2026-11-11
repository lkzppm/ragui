"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Starts drawing on a canvas and returns the function that stops it. */
export type Mount = (options: { canvas: HTMLCanvasElement; onError?: (error: unknown) => void }) => () => void;

const noop = () => {};
const subscribeNever = () => noop;

/**
 * Runs a WebGPU background on a canvas. `load` brings the code in only when
 * it is going to run, and must be the same function on every render. `still`
 * says to draw something that does not move instead: no WebGPU, a visitor
 * who asked for reduced motion, or a start that failed.
 */
export function useGpuCanvas(name: string, load: () => Promise<Mount>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasWebGpu = useSyncExternalStore(
    subscribeNever,
    () => "gpu" in navigator,
    () => true,
  );
  const reducedMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const still = !hasWebGpu || reducedMotion || failed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || still) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    load().then((mount) => {
      if (cancelled) return;
      dispose = mount({
        canvas,
        onError: (error) => {
          console.warn(`[${name}] WebGPU failed, drawing a still frame`, error);
          setFailed(true);
        },
      });
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [still, name, load]);

  return { canvasRef, still };
}
