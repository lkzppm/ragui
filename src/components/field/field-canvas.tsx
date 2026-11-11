"use client";

import { useEffect, useRef } from "react";
import { readPalette } from "./palette";
import { Space } from "./space";
import { useGpuCanvas } from "./use-gpu-canvas";

const loadField = () => import("./mount").then((module) => module.mountField);

/**
 * The landing page's background: a toy embedding space. Passages are
 * points, the pointer is the question, and the lines go to its nearest
 * neighbours, found the way the lab finds them (WebGPU via vgpu). A click
 * sends a search ring across the points. Without WebGPU, or for a visitor
 * who asked for reduced motion, one still frame on a 2D canvas.
 * Decorative: `aria-hidden`, and clicks on controls never reach it.
 */
export function EmbeddingField({ className = "pointer-events-none absolute inset-0 overflow-hidden" }: { className?: string }) {
  const { canvasRef, still } = useGpuCanvas("field", loadField);
  return (
    <div className={className} aria-hidden>
      {still ? <StillField /> : <canvas ref={canvasRef} className="block h-full w-full" />}
    </div>
  );
}

/** The same space at rest, drawn once on the CPU: the points, the question and its nearest. */
function StillField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const palette = readPalette();
      const css = (color: number[], alpha = 1) => `rgba(${color.slice(0, 3).map((channel) => Math.round(channel * 255)).join(",")},${alpha})`;
      const space = new Space();
      space.aspect = width / height;
      // Long enough for the nearest to be found and lit.
      for (let i = 0; i < 60; i++) space.step(1 / 30);
      context.clearRect(0, 0, width, height);
      const [qx, qy] = [space.query[0] * width, space.query[1] * height];
      const glow = context.createRadialGradient(qx, qy, 0, qx, qy, height * 0.45);
      glow.addColorStop(0, css(palette.accent, 0.12));
      glow.addColorStop(1, css(palette.accent, 0));
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      context.lineWidth = 1.25;
      for (const point of space.links()) {
        context.strokeStyle = css(palette.accent, 0.6 * point.near);
        context.beginPath();
        context.moveTo(qx, qy);
        context.lineTo(point.x * width, point.y * height);
        context.stroke();
      }
      for (const point of space.points) {
        context.fillStyle = point.near > 0.5 ? css(palette.accent, 1) : css(palette.rest, 0.4);
        context.beginPath();
        context.arc(point.x * width, point.y * height, 2.6 * (1 + 0.9 * point.near), 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = css(palette.accent);
      context.beginPath();
      context.arc(qx, qy, 5.5, 0, Math.PI * 2);
      context.fill();
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", paint);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", paint);
    };
  }, []);
  return <canvas ref={ref} className="block h-full w-full" />;
}
