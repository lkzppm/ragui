"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING, SPRING_DROP } from "@/lib/motion";
import { stepOf, type Index, type QueryTrace } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { slotOf } from "@/lib/store/playhead";
import { useEntered, useRevealed } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";

const PAD = 28;

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The passages as points, placed by the two directions in which their
 * vectors differ most. The question lands among them; every point then
 * takes the strength of its real similarity, lines go to the closest in
 * rank order, and the ones that reach the context get their number.
 * A picture of the search, not the search: the note under it says so.
 */
export function EmbeddingMap({ index, trace }: { index: Index; trace: QueryTrace | null }) {
  const t = useT();
  const hovered = useLab((state) => state.hovered);
  const hover = useLab((state) => state.hover);
  const mode = useLab((state) => state.settings.retrieve.mode);
  const [ref, size] = useSize<HTMLDivElement>();

  const query = stepOf(trace, "query");
  const dense = stepOf(trace, "dense");
  const sparse = stepOf(trace, "sparse");
  const diversified = stepOf(trace, "diversify");
  const assembled = stepOf(trace, "assemble");

  const asked = useEntered(slotOf("query")) && Boolean(query);
  const lines = useRevealed(slotOf("dense"), dense?.hits.length ?? 0);
  const scanned = useEntered(slotOf("dense")) && Boolean(dense);
  const chosen = useEntered(slotOf("diversify")) && Boolean(diversified);
  const numbered = useEntered(slotOf("assemble")) && Boolean(assembled);

  // One scale for both axes' extents, so the picture fills the panel whatever its shape.
  const layout = useMemo(() => {
    const { points } = index.projection;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const include = (x: number, y: number) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    };
    for (let i = 0; i < points.length; i += 2) include(points[i], points[i + 1]);
    if (query) include(query.point[0], query.point[1]);
    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const place = (x: number, y: number): [number, number] => [
      PAD + ((x - minX) / spanX) * Math.max(1, size.width - PAD * 2),
      PAD + (1 - (y - minY) / spanY) * Math.max(1, size.height - PAD * 2),
    ];
    return { place, at: (i: number) => place(points[i * 2], points[i * 2 + 1]) };
  }, [index, query, size]);

  const strength = useMemo(() => {
    if (!dense) return null;
    let low = Infinity;
    let high = -Infinity;
    for (const score of dense.scores) {
      low = Math.min(low, score);
      high = Math.max(high, score);
    }
    return (i: number) => (dense.scores[i] - low) / Math.max(1e-6, high - low);
  }, [dense]);

  const kept = new Set(chosen ? diversified!.kept.map((hit) => hit.chunk) : []);
  const droppedSet = new Set(chosen ? diversified!.dropped.map((hit) => hit.chunk) : []);
  const sparseSet = new Set(scanned && mode !== "dense" ? (sparse?.hits.map((hit) => hit.chunk) ?? []) : []);
  const sourceOf = new Map<number, number>();
  if (numbered) for (const source of assembled!.sources) for (const chunk of source.chunks) sourceOf.set(chunk, source.n);

  const origin = query ? layout.place(query.point[0], query.point[1]) : null;
  const tip = hovered !== null && hovered < index.chunks.length ? { chunk: index.chunks[hovered], at: layout.at(hovered) } : null;
  const explained = Math.round((index.projection.explained[0] + index.projection.explained[1]) * 100);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-10 shrink-0 items-center gap-3 px-5">
        <h3 className="eyebrow">{t.lab.retriever.map}</h3>
      </header>
      <div ref={ref} className="relative min-h-0 flex-1 max-lg:h-64 max-lg:flex-none" onPointerLeave={() => hover(null)}>
        {size.width > 0 && (
          <svg width={size.width} height={size.height} className="absolute inset-0">
            {/* Lines from the question to its nearest passages, drawn in rank order as the search plays. */}
            {origin &&
              mode !== "sparse" &&
              dense?.hits.slice(0, lines).map((hit) => {
                const [x, y] = layout.at(hit.chunk);
                return (
                  <motion.line
                    key={`line-${hit.chunk}`}
                    x1={origin[0]}
                    y1={origin[1]}
                    x2={x}
                    y2={y}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: kept.size && !kept.has(hit.chunk) ? 0.12 : 0.75 - (hit.rank - 1) * 0.06 }}
                    transition={SPRING}
                    className="stroke-query"
                    strokeWidth={kept.has(hit.chunk) ? 1.75 : 1}
                    strokeLinecap="round"
                  />
                );
              })}

            {index.chunks.map((chunk, i) => {
              const [x, y] = layout.at(i);
              const isKept = kept.has(i);
              const isDropped = droppedSet.has(i);
              const isHit = dense?.hits.slice(0, lines).some((hit) => hit.chunk === i) ?? false;
              const lit = hovered === i;
              const opacity = scanned && strength ? 0.22 + 0.78 * strength(i) : 0.7;
              return (
                <g key={chunk.id} onPointerEnter={() => hover(i)} className="cursor-default">
                  {/* A keyword hit wears a square: found by its words. */}
                  <AnimatePresence>
                    {sparseSet.has(i) && (
                      <motion.rect
                        key="sparse"
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 0.9, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.4 }}
                        transition={SPRING}
                        x={x - 9}
                        y={y - 9}
                        width={18}
                        height={18}
                        rx={4}
                        className="fill-none stroke-corpus"
                        strokeWidth={1}
                        strokeDasharray="2 2.5"
                        style={{ transformOrigin: `${x}px ${y}px` }}
                      />
                    )}
                  </AnimatePresence>
                  <motion.circle
                    cx={x}
                    cy={y}
                    initial={{ r: 0, opacity: 0 }}
                    animate={{ r: lit ? 8 : isKept ? 6.5 : isHit ? 5.5 : 4.5, opacity: lit ? 1 : isDropped ? 0.3 : opacity }}
                    transition={SPRING}
                    className={cn("transition-[fill,stroke] duration-300", isKept || (isHit && !chosen) ? "fill-query" : "fill-corpus", lit && "stroke-foreground")}
                    strokeWidth={lit ? 1.5 : 0}
                  />
                  {/* A larger target than the dot, so the pointer does not have to be exact. */}
                  <circle cx={x} cy={y} r={13} fill="transparent" />
                  <AnimatePresence>
                    {sourceOf.has(i) && (
                      // In SVG, motion reads `y` as a translation, so the label is placed by attributes and only fades and grows.
                      <motion.g key="n" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} transition={SPRING_DROP} style={{ transformOrigin: `${x}px ${y}px` }}>
                        <rect x={x + 8} y={y - 19} width={16} height={14} rx={3.5} className="fill-query" />
                        <text x={x + 16} y={y - 8.5} textAnchor="middle" className="num fill-query-foreground text-[10px] font-medium">
                          {sourceOf.get(i)}
                        </text>
                      </motion.g>
                    )}
                  </AnimatePresence>
                </g>
              );
            })}

            <AnimatePresence>
              {asked && origin && (
                <motion.g key={query!.text} initial={{ opacity: 0, scale: 2.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SPRING_DROP} style={{ transformOrigin: `${origin[0]}px ${origin[1]}px` }}>
                  <circle cx={origin[0]} cy={origin[1]} r={13} className="fill-query/15" />
                  <circle cx={origin[0]} cy={origin[1]} r={6} className="fill-query stroke-background" strokeWidth={2} />
                  <text x={origin[0]} y={origin[1] + 26} textAnchor="middle" className="eyebrow fill-query text-[10px]">
                    {t.lab.retriever.question}
                  </text>
                </motion.g>
              )}
            </AnimatePresence>
          </svg>
        )}

        <AnimatePresence>
          {tip && (
            <motion.div
              key={tip.chunk.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="glass pointer-events-none absolute z-10 w-56 rounded-lg border border-border p-2.5 shadow-[var(--shadow-float)]"
              style={{ left: Math.min(Math.max(8, tip.at[0] + 14), Math.max(8, size.width - 232)), top: Math.min(tip.at[1] + 14, Math.max(8, size.height - 96)) }}
            >
              <div className="flex items-baseline gap-2 text-xs font-medium">
                <span className="num text-muted-foreground">#{tip.chunk.index}</span>
                <span className="truncate" lang="pt-BR">{tip.chunk.title ?? ""}</span>
                {dense && <span className="num ml-auto text-query">{dense.scores[tip.chunk.index].toFixed(3)}</span>}
              </div>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground" lang="pt-BR">
                {tip.chunk.text.replace(/\s+/g, " ")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="shrink-0 px-5 pt-1 pb-3 text-[0.6875rem] leading-relaxed text-muted-foreground">{t.lab.retriever.mapNote(explained)}</p>
    </section>
  );
}
