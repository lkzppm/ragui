import { clock, effect, frameLoop, init, surface } from "vgpu";
import { CELL_CSS, DOT_CSS } from "./cells";
import cellsShader from "./cells.wgsl";
import { readPalette, watchPalette } from "./palette";

export interface CellsOptions {
  canvas: HTMLCanvasElement;
  onError?: (error: unknown) => void;
}

/** Fraction of the remaining distance the question covers per frame at 60 fps: quick after the pointer, slow on its own. */
const FOLLOW_POINTER = 0.1;
const FOLLOW_PATH = 0.03;

/**
 * Draws the page of cells on `canvas` with vgpu: one fullscreen effect. The
 * question follows the pointer while it is over the canvas and wanders a
 * slow closed path otherwise. Nothing is drawn while the canvas is off
 * screen or the tab is hidden. Returns the function that stops everything.
 */
export function mountCells(options: CellsOptions): () => void {
  let disposed = false;
  let cleanup: (() => void) | undefined;

  (async () => {
    const gpu = await init();
    if (disposed) return gpu.dispose();
    const canvasSurface = surface(gpu, options.canvas, { dpr: [1, 2] });
    const time = clock(gpu);

    let palette = readPalette();
    const unwatchPalette = watchPalette((next) => {
      palette = next;
    });

    let visible = false;
    const visibility = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    visibility.observe(options.canvas);

    let target: [number, number] | null = null;
    const onMove = (event: PointerEvent) => {
      const rect = options.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      target = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? [x, y] : null;
    };
    const onLeave = () => {
      target = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    const query: [number, number] = [0.5, 0.42];
    // Its own clock, so the page does not jump ahead after being off screen.
    let seconds = 0;
    const params = (aspect: number) => ({
      texel: canvasSurface.texelSize,
      query,
      cell: CELL_CSS * canvasSurface.dpr,
      radius: DOT_CSS * canvasSurface.dpr,
      time: seconds,
      aspect,
      intensity: 1,
      background: palette.background,
      rest: palette.rest,
      accent: palette.accent,
    });

    const cells = effect(gpu, cellsShader, { label: "cells", set: { params: params(16 / 9) } });
    await cells.compile({ colors: [canvasSurface.format] });
    if (disposed) {
      canvasSurface.dispose();
      return gpu.dispose();
    }

    const loop = frameLoop(gpu, (frame) => {
      if (document.hidden || !visible) return;
      const width = options.canvas.clientWidth;
      const height = options.canvas.clientHeight;
      if (width === 0 || height === 0) return;
      // A canvas coming back on screen reports one huge delta.
      const dt = Math.min(0.1, Math.max(0, time.deltaTime));
      seconds += dt;

      const goal = target ?? [0.5 + 0.3 * Math.sin(seconds * 0.19), 0.46 + 0.26 * Math.sin(seconds * 0.27 + 1.1)];
      const follow = 1 - Math.pow(1 - (target ? FOLLOW_POINTER : FOLLOW_PATH), dt * 60);
      query[0] += (goal[0] - query[0]) * follow;
      query[1] += (goal[1] - query[1]) * follow;

      cells.set({ params: params(width / height) });
      frame.pass({ target: canvasSurface }, (pass) => {
        pass.draw(cells);
      });
    });

    cleanup = () => {
      loop.stop();
      unwatchPalette();
      visibility.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      canvasSurface.dispose();
      gpu.dispose();
    };
  })().catch((error) => {
    if (!disposed) options.onError?.(error);
  });

  return () => {
    disposed = true;
    cleanup?.();
  };
}
