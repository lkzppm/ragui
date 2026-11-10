"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import data from "./figure-data.json";

/** Seconds a question stays before the next one comes in. */
const SECONDS = 8;

type Run = (typeof data.runs)[number];
type Row = { chunk: number; title: string; score: number; holder: boolean; denseRank?: number | null; sparseRank?: number | null; kept?: boolean };

/**
 * The landing page's figure: the sample's four test questions, each as the
 * three rankings it produced. The numbers are real: `pnpm rag figure` runs
 * the pipeline and writes them. The questions turn on their own, a line
 * filling under the current one; the pointer on the figure pauses it.
 * The passage that holds the answer is marked in each list, so the eye can
 * follow where each search put it.
 */
export function HomeFigure({ className }: { className?: string }) {
  const t = useT();
  const f = t.how.figure;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const run: Run = data.runs[active];

  return (
    <figure
      className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-float)]", className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={run.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING} className="min-w-0 flex-1 truncate font-medium tracking-tight" lang="pt-BR">
            {run.question}
          </motion.p>
        </AnimatePresence>
        {/* One segment per question; the current one fills as its time runs. */}
        <div className="flex shrink-0 gap-1.5" role="tablist">
          {data.runs.map((candidate, i) => (
            <button key={candidate.id} type="button" role="tab" aria-selected={i === active} aria-label={candidate.question} title={candidate.question} onClick={() => setActive(i)} className="press group -my-2 py-2">
              <span className={cn("relative block h-1 w-7 overflow-hidden rounded-full transition-colors duration-300", i === active ? "bg-query/25" : "bg-border group-hover:bg-foreground/30")}>
                {i === active && (
                  <span
                    key={active}
                    className="absolute inset-0 origin-left rounded-full bg-query"
                    style={{ animation: `grow ${SECONDS}s linear forwards`, animationPlayState: paused ? "paused" : "running" }}
                    onAnimationEnd={() => setActive((current) => (current + 1) % data.runs.length)}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border">
        <List title={f.dense} rows={run.dense} run={run.id} found={f.found} />
        <List title={f.sparse} rows={run.sparse} run={run.id} found={f.found} />
        <List title={f.fused} rows={run.fused} run={run.id} found={f.found} accent />
      </div>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={run.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={SPRING} className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-query" />
            <span className="num text-foreground" lang="pt-BR">{run.expect}</span>
          </motion.span>
        </AnimatePresence>
        <span>{f.note}</span>
      </figcaption>
    </figure>
  );
}

function List({ title, rows, run, found, accent = false }: { title: string; rows: Row[]; run: string; found: string; accent?: boolean }) {
  const top = rows[0]?.score ?? 1;
  const low = Math.min(...rows.map((row) => row.score));
  let n = 0;
  return (
    <div className="flex min-w-0 flex-col bg-card px-2.5 pt-2.5 pb-3">
      <h3 className={cn("eyebrow px-1.5 pb-2", accent && "text-query")}>{title}</h3>
      <ol className="flex min-h-[14.5rem] flex-col gap-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {rows.map((row, i) => {
            const source = row.kept ? ++n : null;
            // Scores in one list sit close together; the bar stretches their spread.
            const share = top === low ? 1 : 0.3 + 0.7 * ((row.score - low) / (top - low));
            return (
              <motion.li
                key={`${run}-${row.chunk}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ ...SPRING, delay: i * 0.045 }}
                title={row.holder ? found : undefined}
                className={cn("flex flex-col gap-1 rounded-lg border px-2 py-1.5", row.holder ? "border-query/50 bg-query/[0.07]" : "border-border")}
              >
                <div className="flex items-baseline gap-1.5 text-xs">
                  <span className="num w-3 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span className={cn("min-w-0 flex-1 truncate", row.holder ? "font-medium text-foreground" : "text-muted-foreground")} lang="pt-BR">
                    {row.title}
                  </span>
                  {source !== null && <span className="num rounded bg-query px-1 text-[0.625rem] font-medium text-query-foreground">{source}</span>}
                </div>
                <span className="relative h-[3px] overflow-hidden rounded-full bg-muted">
                  <motion.span className={cn("absolute inset-0 origin-left rounded-full", row.holder ? "bg-query" : "bg-corpus/70")} initial={{ scaleX: 0 }} animate={{ scaleX: share }} transition={{ ...SPRING, delay: i * 0.045 }} />
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}
