"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { animate, AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { InfoTip } from "@/components/lab/info-tip";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING, SPRING_DROP } from "@/lib/motion";
import { mesh, neighboursOf } from "@/lib/rag/neighbours";
import { stepOf, type Index, type QueryTrace } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { slotOf } from "@/lib/store/playhead";
import { useEntered, useRevealed } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";

const PAD = 28;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 12;
/** Links each passage keeps in the graph, and how many a pointed-at passage shows with their cosines. */
const MESH_LINKS = 2;
const FOCUS_LINKS = 5;
/** Past this many passages the all-pairs graph is not drawn: too many lines to read, and to compute on a frame. */
const MESH_LIMIT = 400;
/** A press that moves less than this is a click, not a drag. */
const SLOP = 4;

/** Where the visitor has taken the picture: a zoom about the centre of the panel, then a shift. */
interface View {
  k: number;
  x: number;
  y: number;
}
const HOME: View = { k: 1, x: 0, y: 0 };

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** The view after zooming by `factor` with the point `(px, py)` of the panel held still. */
function zoomAbout(view: View, factor: number, px: number, py: number, width: number, height: number): View {
  const k = clampZoom(view.k * factor);
  const cx = width / 2;
  const cy = height / 2;
  const worldX = (px - cx - view.x) / view.k;
  const worldY = (py - cy - view.y) / view.k;
  return { k, x: px - cx - worldX * k, y: py - cy - worldY * k };
}

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
 * The passages as a graph, placed by the two directions in which their
 * vectors differ most and joined to the ones most like them. It can be
 * dragged, zoomed and asked: pointing at a passage shows its nearest
 * neighbours with their cosines, clicking pins it. The question lands
 * among them; every point then takes the strength of its real similarity,
 * lines go to the closest in rank order, and the ones that reach the
 * context get their number. A picture of the search, not the search: the
 * note under it says so.
 */
export function EmbeddingMap({ index, trace }: { index: Index; trace: QueryTrace | null }) {
  const t = useT();
  const r = t.lab.retriever;
  const hovered = useLab((state) => state.hovered);
  const hover = useLab((state) => state.hover);
  const mode = useLab((state) => state.settings.retrieve.mode);
  const [ref, size] = useSize<HTMLDivElement>();
  const [view, setView] = useState<View>(HOME);
  const [pinned, setPinned] = useState<number | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; x: number; y: number; spread: number; moved: boolean } | null>(null);
  const glide = useRef<{ stop: () => void } | null>(null);

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

  // From where a thing is in the fitted picture to where it is on screen, after the visitor's zoom and shift.
  const onScreen = ([x, y]: [number, number]): [number, number] => [(x - size.width / 2) * view.k + size.width / 2 + view.x, (y - size.height / 2) * view.k + size.height / 2 + view.y];
  const at = (i: number) => onScreen(layout.at(i));

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

  const links = useMemo(() => (index.chunks.length <= MESH_LIMIT ? mesh(index.vectors, index.model.dims, MESH_LINKS) : []), [index]);
  // What is pointed at, here or in another panel; failing that, what is pinned.
  const focus = hovered !== null && hovered < index.chunks.length ? hovered : pinned !== null && pinned < index.chunks.length ? pinned : null;
  const near = useMemo(() => (focus === null ? [] : neighboursOf(index.vectors, index.model.dims, focus, FOCUS_LINKS)), [index, focus]);

  const kept = new Set(chosen ? diversified!.kept.map((hit) => hit.chunk) : []);
  const droppedSet = new Set(chosen ? diversified!.dropped.map((hit) => hit.chunk) : []);
  const sparseSet = new Set(scanned && mode !== "dense" ? (sparse?.hits.map((hit) => hit.chunk) ?? []) : []);
  const sourceOf = new Map<number, number>();
  if (numbered) for (const source of assembled!.sources) for (const chunk of source.chunks) sourceOf.set(chunk, source.n);
  const nearSet = new Set(near.map((hit) => hit.chunk));

  const origin = query ? onScreen(layout.place(query.point[0], query.point[1])) : null;
  const tip = focus !== null ? { chunk: index.chunks[focus], at: at(focus) } : null;
  const explained = Math.round((index.projection.explained[0] + index.projection.explained[1]) * 100);
  const moved = view.k !== 1 || view.x !== 0 || view.y !== 0;

  // The wheel zooms about the pointer. Registered by hand: a wheel listener that cancels the scroll may not be passive.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      glide.current?.stop();
      const box = element.getBoundingClientRect();
      // A pinch on a trackpad arrives as a wheel with the control key, in finer steps.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.012 : 0.0018));
      setView((current) => zoomAbout(current, factor, event.clientX - box.left, event.clientY - box.top, box.width, box.height));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref]);

  /** Moves the view to where `to` says, on a spring. The buttons use it; a finger moves the view directly. */
  const glideTo = (to: (from: View) => View) => {
    glide.current?.stop();
    const from = view;
    const target = to(from);
    glide.current = animate(0, 1, {
      ...SPRING,
      onUpdate: (progress) => setView({ k: from.k + (target.k - from.k) * progress, x: from.x + (target.x - from.x) * progress, y: from.y + (target.y - from.y) * progress }),
    });
  };

  const local = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  /** Starts a gesture from the fingers that are down now: one drags, two pinch. */
  const begin = () => {
    const [first, second] = [...pointers.current.values()];
    if (!first) return void (gesture.current = null);
    const x = second ? (first.x + second.x) / 2 : first.x;
    const y = second ? (first.y + second.y) / 2 : first.y;
    gesture.current = { view, x, y, spread: second ? Math.hypot(first.x - second.x, first.y - second.y) : 0, moved: gesture.current?.moved ?? false };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    glide.current?.stop();
    pointers.current.set(event.pointerId, local(event));
    if (pointers.current.size === 1) gesture.current = null;
    begin();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, local(event));
    const start = gesture.current;
    const [first, second] = [...pointers.current.values()];
    const x = second ? (first.x + second.x) / 2 : first.x;
    const y = second ? (first.y + second.y) / 2 : first.y;
    if (!start.moved) {
      if (!second && Math.hypot(x - start.x, y - start.y) < SLOP) return;
      start.moved = true;
      // From here on the panel has the pointer, so the drag carries on outside it and no passage is clicked on release.
      event.currentTarget.setPointerCapture(event.pointerId);
      setGrabbing(true);
      hover(pinned);
    }
    const shifted = { ...start.view, x: start.view.x + x - start.x, y: start.view.y + y - start.y };
    setView(second && start.spread > 0 ? zoomAbout(shifted, Math.hypot(first.x - second.x, first.y - second.y) / start.spread, x, y, size.width, size.height) : shifted);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const wasDrag = gesture.current?.moved ?? false;
    if (pointers.current.size) return begin();
    gesture.current = null;
    setGrabbing(false);
    // A click on the empty space lets go of the pinned passage.
    if (!wasDrag && event.type === "pointerup" && !(event.target as Element).closest("[data-node]")) {
      setPinned(null);
      hover(null);
    }
  };

  const pin = (i: number) => {
    const next = pinned === i ? null : i;
    setPinned(next);
    hover(next);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-10 shrink-0 items-center gap-1.5 px-5">
        <h3 className="eyebrow">{r.map}</h3>
        <InfoTip label={r.mapAbout}>
          <p>{r.mapHelp}</p>
          <p className="text-muted-foreground">{r.mapLinks}</p>
        </InfoTip>
      </header>
      <div
        ref={ref}
        className={cn("relative min-h-0 flex-1 touch-none overflow-hidden select-none max-lg:h-64 max-lg:flex-none max-lg:touch-pan-y", grabbing ? "cursor-grabbing" : "cursor-grab")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => !grabbing && hover(pinned)}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest("[data-chrome]")) return;
          const point = { x: event.clientX - event.currentTarget.getBoundingClientRect().left, y: event.clientY - event.currentTarget.getBoundingClientRect().top };
          glideTo((from) => zoomAbout(from, 1.8, point.x, point.y, size.width, size.height));
        }}
      >
        {size.width > 0 && (
          <svg width={size.width} height={size.height} className="absolute inset-0">
            {/* The graph at rest: every passage joined to the ones most like it, stronger where they are closer. */}
            {links.map((link) => {
              const [x1, y1] = at(link.a);
              const [x2, y2] = at(link.b);
              const touched = focus !== null && (link.a === focus || link.b === focus);
              return <line key={`${link.a}-${link.b}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-foreground transition-opacity duration-300" strokeWidth={1} opacity={touched ? 0 : focus !== null ? 0.05 : 0.06 + 0.14 * Math.max(0, link.score - 0.7) * (1 / 0.3)} />;
            })}

            {/* What the pointed-at passage is nearest to, with the cosine of each. */}
            {focus !== null &&
              near.map((hit) => {
                const [x1, y1] = at(focus);
                const [x2, y2] = at(hit.chunk);
                return (
                  <motion.g key={`near-${focus}-${hit.chunk}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-corpus" strokeWidth={1.25} strokeLinecap="round" opacity={0.85 - (hit.rank - 1) * 0.12} />
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 3} textAnchor="middle" className="num fill-foreground stroke-background text-[9px]" strokeWidth={3} paintOrder="stroke">
                      {hit.score.toFixed(2)}
                    </text>
                  </motion.g>
                );
              })}

            {/* Lines from the question to its nearest passages, drawn in rank order as the search plays. */}
            {origin &&
              mode !== "sparse" &&
              dense?.hits.slice(0, lines).map((hit) => {
                const [x, y] = at(hit.chunk);
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
              const [x, y] = at(i);
              const isKept = kept.has(i);
              const isDropped = droppedSet.has(i);
              const isHit = dense?.hits.slice(0, lines).some((hit) => hit.chunk === i) ?? false;
              const lit = focus === i;
              const isNear = nearSet.has(i);
              const opacity = scanned && strength ? 0.22 + 0.78 * strength(i) : 0.7;
              return (
                <g key={chunk.id} data-node onPointerEnter={() => !grabbing && hover(i)} onClick={() => pin(i)} className="cursor-pointer">
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
                  {/* The pinned passage keeps a ring, so it is found again after looking elsewhere. */}
                  {pinned === i && <circle cx={x} cy={y} r={12} className="fill-none stroke-foreground/50" strokeWidth={1} strokeDasharray="1.5 3" />}
                  <motion.circle
                    cx={x}
                    cy={y}
                    initial={{ r: 0, opacity: 0 }}
                    animate={{ r: lit ? 8 : isKept ? 6.5 : isHit || isNear ? 5.5 : 4.5, opacity: lit || isNear ? 1 : isDropped ? 0.3 : focus !== null ? opacity * 0.6 : opacity }}
                    transition={SPRING}
                    className={cn("transition-[fill,stroke] duration-300", isKept || (isHit && !chosen) ? "fill-query" : "fill-corpus", lit && "stroke-foreground")}
                    strokeWidth={lit ? 1.5 : 0}
                  />
                  {/* A larger target than the dot, so the pointer does not have to be exact. */}
                  <circle cx={x} cy={y} r={13} fill="transparent" />
                  {/* Close enough, every passage says which one it is. */}
                  {view.k >= 2 && (
                    <text x={x} y={y + 19} textAnchor="middle" className="num pointer-events-none fill-muted-foreground text-[9px]">
                      #{chunk.index}
                    </text>
                  )}
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
                <motion.g key={query!.text} initial={{ opacity: 0, scale: 2.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SPRING_DROP} style={{ transformOrigin: `${origin[0]}px ${origin[1]}px` }} className="pointer-events-none">
                  <circle cx={origin[0]} cy={origin[1]} r={13} className="fill-query/15" />
                  <circle cx={origin[0]} cy={origin[1]} r={6} className="fill-query stroke-background" strokeWidth={2} />
                  <text x={origin[0]} y={origin[1] + 26} textAnchor="middle" className="eyebrow fill-query text-[10px]">
                    {r.question}
                  </text>
                </motion.g>
              )}
            </AnimatePresence>
          </svg>
        )}

        <AnimatePresence>
          {tip && !grabbing && (
            <motion.div
              key={tip.chunk.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="glass pointer-events-none absolute z-10 w-56 rounded-lg border border-border p-2.5 shadow-[var(--shadow-float)]"
              style={{ left: Math.min(Math.max(8, tip.at[0] + 14), Math.max(8, size.width - 232)), top: Math.min(Math.max(8, tip.at[1] + 14), Math.max(8, size.height - 96)) }}
            >
              <div className="flex items-baseline gap-2 text-xs font-medium">
                <span className="num text-muted-foreground">#{tip.chunk.index}</span>
                <span className="truncate">{tip.chunk.title ?? ""}</span>
                {dense && <span className="num ml-auto text-query">{dense.scores[tip.chunk.index].toFixed(3)}</span>}
              </div>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{tip.chunk.text.replace(/\s+/g, " ")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The view's controls. They take their own presses, so pressing one never starts a drag. */}
        <div data-chrome className="glass absolute right-3 bottom-3 z-10 flex cursor-default items-center rounded-full border border-border p-0.5 shadow-[var(--shadow-float)]" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <MapButton label={r.zoomOut} disabled={view.k <= MIN_ZOOM} onClick={() => glideTo((from) => zoomAbout(from, 1 / 1.6, size.width / 2, size.height / 2, size.width, size.height))}>
            <Minus className="size-3.5" />
          </MapButton>
          <MapButton label={r.zoomIn} disabled={view.k >= MAX_ZOOM} onClick={() => glideTo((from) => zoomAbout(from, 1.6, size.width / 2, size.height / 2, size.width, size.height))}>
            <Plus className="size-3.5" />
          </MapButton>
          <MapButton label={r.fit} disabled={!moved} onClick={() => glideTo(() => HOME)}>
            <Maximize2 className="size-3.5" />
          </MapButton>
        </div>
      </div>
      <p className="shrink-0 px-5 pt-1 pb-3 text-[0.6875rem] leading-relaxed text-muted-foreground">{r.mapNote(explained)}</p>
    </section>
  );
}

function MapButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="press grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35">
      {children}
    </button>
  );
}
