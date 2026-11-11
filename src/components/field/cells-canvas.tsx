"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { CELL_CSS, DOT_CSS } from "./cells";
import { useGpuCanvas } from "./use-gpu-canvas";

const loadCells = () => import("./mount-cells").then((module) => module.mountCells);

/**
 * The background of the landing page's last screen: a page of cells, like a
 * vector laid flat. Each cell is a number: how close it is to a question
 * that wanders, or follows the pointer, plus a little of its own (WebGPU
 * via vgpu, `cells.wgsl`). Without WebGPU, or for a visitor who asked for
 * reduced motion, the same page at rest, drawn by CSS.
 * Decorative: `aria-hidden`, and it takes no pointer events.
 */
export function CellField({ className }: { className?: string }) {
  const { canvasRef, still } = useGpuCanvas("cells", loadCells);
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {still ? (
        <div
          className="absolute inset-0 [background-image:radial-gradient(var(--border)_var(--dot),transparent_var(--dot))] [background-position:center] [background-size:var(--cell)_var(--cell)] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_72%)]"
          style={{ "--cell": `${CELL_CSS}px`, "--dot": `${DOT_CSS}px` } as CSSProperties}
        />
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}
