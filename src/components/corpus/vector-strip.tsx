"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

function cssColor(name: string): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#888888";
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * A vector as a strip of cells, one per dimension: the question's colour
 * where the number is positive, the corpus colour where it is negative,
 * stronger the further it is from zero. Two rows, so 384 cells fit a card.
 */
export function VectorStrip({ vector, className }: { vector: Float32Array; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const columns = Math.ceil(vector.length / 2);
    canvas.width = columns;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    if (!context) return;
    const positive = cssColor("--query");
    const negative = cssColor("--corpus");
    let peak = 1e-6;
    for (const value of vector) peak = Math.max(peak, Math.abs(value));
    const image = context.createImageData(columns, 2);
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i];
      const colour = value >= 0 ? positive : negative;
      const offset = ((i % 2) * columns + Math.floor(i / 2)) * 4;
      image.data[offset] = colour[0];
      image.data[offset + 1] = colour[1];
      image.data[offset + 2] = colour[2];
      image.data[offset + 3] = Math.round(255 * Math.pow(Math.abs(value) / peak, 0.7));
    }
    context.putImageData(image, 0, 0);
  }, [vector, theme]);
  return <canvas ref={ref} className={cn("block h-2 w-full rounded-[3px] [image-rendering:pixelated]", className)} aria-hidden />;
}
