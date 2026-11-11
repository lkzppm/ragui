"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const POINTS = 72;
/** Points closer than this, in CSS pixels, are joined; the line fades as they part. */
const REACH = 150;
/** How many points the pointer, as a question, reaches for. */
const NEAREST = 5;

/** A small seeded generator, so the drawing starts the same on every visit. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Behind the datasets: passages adrift in a plane, each joined to the ones
 * that come near it, and the pointer as a question that reaches for its
 * closest few. The idea of the lab as a moving picture; nothing here is
 * computed from a document. It stands still for whoever asked for less
 * motion, and stops while the tab is hidden.
 */
export function ExplorerBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const random = seeded(7);
    const points = Array.from({ length: POINTS }, () => ({
      x: random(),
      y: random(),
      // A slow drift, in panel widths per second, and a sway of its own on top.
      vx: (random() - 0.5) * 0.012,
      vy: (random() - 0.5) * 0.012,
      phase: random() * Math.PI * 2,
      size: 1.4 + random() * 1.6,
    }));
    const placed = points.map(() => ({ x: 0, y: 0 }));

    let width = 0;
    let height = 0;
    let colours = { corpus: "#64748b", query: "#4f46e5" };
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let last = 0;
    let clock = 0;

    const readColours = () => {
      const style = getComputedStyle(document.documentElement);
      colours = { corpus: style.getPropertyValue("--corpus").trim() || colours.corpus, query: style.getPropertyValue("--query").trim() || colours.query };
    };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (dt: number) => {
      clock += dt;
      context.clearRect(0, 0, width, height);
      points.forEach((point, i) => {
        point.x += point.vx * dt;
        point.y += point.vy * dt;
        // Leaving by one side, a point comes back by the other.
        if (point.x < -0.05) point.x += 1.1;
        else if (point.x > 1.05) point.x -= 1.1;
        if (point.y < -0.05) point.y += 1.1;
        else if (point.y > 1.05) point.y -= 1.1;
        placed[i].x = point.x * width + Math.cos(clock * 0.35 + point.phase) * 10;
        placed[i].y = point.y * height + Math.sin(clock * 0.28 + point.phase * 1.7) * 10;
      });

      context.lineWidth = 1;
      context.strokeStyle = colours.corpus;
      for (let i = 0; i < POINTS; i++) {
        for (let j = i + 1; j < POINTS; j++) {
          const distance = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y);
          if (distance > REACH) continue;
          context.globalAlpha = 0.22 * (1 - distance / REACH);
          context.beginPath();
          context.moveTo(placed[i].x, placed[i].y);
          context.lineTo(placed[j].x, placed[j].y);
          context.stroke();
        }
      }

      const reached = new Set<number>();
      if (pointer) {
        const at = pointer;
        const order = placed.map((p, i) => ({ i, distance: Math.hypot(p.x - at.x, p.y - at.y) })).sort((a, b) => a.distance - b.distance);
        context.strokeStyle = colours.query;
        order.slice(0, NEAREST).forEach(({ i, distance }, rank) => {
          if (distance > REACH * 2.2) return;
          reached.add(i);
          context.globalAlpha = (0.6 - rank * 0.09) * (1 - distance / (REACH * 2.2));
          context.beginPath();
          context.moveTo(at.x, at.y);
          context.lineTo(placed[i].x, placed[i].y);
          context.stroke();
        });
      }

      placed.forEach((p, i) => {
        const lit = reached.has(i);
        context.globalAlpha = lit ? 0.9 : 0.42;
        context.fillStyle = lit ? colours.query : colours.corpus;
        context.beginPath();
        context.arc(p.x, p.y, points[i].size + (lit ? 1 : 0), 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      draw(dt);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (still.matches) draw(0);
      else frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      if (still.matches) draw(0);
    };
    const onLeave = () => {
      pointer = null;
      if (still.matches) draw(0);
    };

    readColours();
    resize();
    start();
    const observer = new ResizeObserver(() => {
      resize();
      if (still.matches) draw(0);
    });
    observer.observe(canvas);
    // The theme is a class on the root element: when it changes, so do the colours.
    const theme = new MutationObserver(() => {
      readColours();
      if (still.matches) draw(0);
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    still.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      theme.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      still.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none animate-in duration-1000 fade-in", className)} />;
}
