"use client";

import { AnimatePresence, LayoutGroup, motion, useInView } from "motion/react";
import { useId, useRef, useState } from "react";
import { STAGE_ICONS } from "@/components/pipeline/stage-icons";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING, SPRING_FAST } from "@/lib/motion";
import { RAIL, STAGES, stageOf, usesModel, type StageGroup } from "@/lib/rag/stages";
import type { StageId } from "@/lib/rag/types";
import { slotOf } from "@/lib/store/playhead";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/** Seconds a stage stays before the next one takes its place. */
const SECONDS = 6;

const GROUPS: readonly StageGroup[] = ["ingest", "query"];
const ORDER: readonly StageId[] = STAGES.map((stage) => stage.id);

const TAG = "eyebrow shrink-0 rounded border px-1.5 py-px";

/**
 * The landing page's figure: the pipeline explained stage by stage, drawn
 * from the same list the lab's rail reads (`STAGES`, `RAIL`), with each
 * stage's own explanation and formula. Indexing on the left, the question
 * on the right, each a line of stages in the order they run; the two
 * searches share a row because they run side by side. The stage being
 * explained moves on by itself, the line filling behind it, and waits
 * while the pointer or the keyboard is on the figure. Pointing at a stage,
 * or pressing it, explains that one.
 */
export function HomePipeline({ className }: { className?: string }) {
  const t = useT();
  const uid = useId();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<StageId>(ORDER[0]);
  const [held, setHeld] = useState(false);

  const stage = stageOf(active);
  const number = ORDER.indexOf(active) + 1;
  const now = slotOf(active);
  const Icon = STAGE_ICONS[active];
  const by = usesModel(active) ? "model" : "code";
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    <figure
      ref={ref}
      aria-label={t.how.figure}
      className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-float)]", className)}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <LayoutGroup id={uid}>
        <div className="grid gap-x-5 gap-y-6 p-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {GROUPS.map((group) => (
            <section key={group} className={cn(group === "query" && "sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:border-l sm:border-border sm:pl-5")}>
              <h3 className="eyebrow text-foreground">{t.lab.groups[group].name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t.lab.groups[group].hint}</p>
              <ol className="mt-4">
                {RAIL[group].map((column, row) => {
                  const slot = slotOf(column[0]);
                  const reached = slot <= now;
                  return (
                    <li key={column.join("+")} className="relative flex flex-col items-start pb-1 pl-5 last:pb-0">
                      {/* The line to the next stage. It fills once the run has moved past this one. */}
                      {row < RAIL[group].length - 1 && (
                        <span aria-hidden className="absolute top-4 left-[4.5px] h-full w-px bg-border">
                          <span className={cn("absolute inset-0 origin-top bg-query transition-transform duration-500 ease-[var(--ease)]", slot < now ? "scale-y-100" : "scale-y-0")} />
                        </span>
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-[11px] left-0 size-2.5 rounded-full border-[1.5px] transition-[background-color,border-color,box-shadow] duration-300",
                          reached ? "border-query bg-query" : "border-corpus/60 bg-card",
                          slot === now && "shadow-[0_0_0_4px_color-mix(in_srgb,var(--query)_18%,transparent)]",
                        )}
                      />
                      {column.map((id) => {
                        const StageIcon = STAGE_ICONS[id];
                        const current = id === active;
                        return (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={current}
                            onClick={() => setActive(id)}
                            onFocus={() => setActive(id)}
                            onPointerEnter={(event) => event.pointerType === "mouse" && setActive(id)}
                            className={cn(
                              "press relative inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                              current ? "text-foreground" : reached ? "text-foreground/80" : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {current && <motion.span layoutId="now" aria-hidden className="absolute inset-0 rounded-lg border border-query/60 bg-query/10" transition={SPRING} />}
                            <span className="num relative text-[0.6875rem] text-muted-foreground">{pad(ORDER.indexOf(id) + 1)}</span>
                            <StageIcon className={cn("relative size-4 shrink-0 transition-colors duration-300", current && "text-query")} aria-hidden />
                            <span className="relative font-medium">{t.stages[id].name}</span>
                            {usesModel(id) && <span className={cn(TAG, "relative border-query/50 text-query")}>{t.lab.by.model.tag}</span>}
                          </button>
                        );
                      })}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {/* Who does the work: every stage is one or the other. */}
          <dl className="flex flex-col gap-2.5 self-end text-xs leading-snug text-muted-foreground sm:col-start-1 sm:row-start-2">
            {(["code", "model"] as const).map((kind) => (
              <div key={kind} className="flex items-start gap-2.5">
                <dt className={cn(TAG, kind === "model" ? "border-query/50 text-query" : "border-border")}>{t.lab.by[kind].tag}</dt>
                <dd>{t.lab.by[kind].hint}</dd>
              </div>
            ))}
          </dl>
        </div>
      </LayoutGroup>

      <div className="relative border-t border-border px-5 py-4" aria-live={held ? "polite" : "off"}>
        {/* The time this stage has left, along the edge. A visitor who asked for less motion moves on by hand. */}
        {!reducedMotion && (
          <span
            key={active}
            aria-hidden
            className="absolute inset-x-0 -top-px h-px origin-left bg-query"
            style={{ animation: `grow ${SECONDS}s linear forwards`, animationPlayState: held || !inView ? "paused" : "running" }}
            onAnimationEnd={() => setActive((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING_FAST}
            className="flex min-h-[15rem] flex-col sm:min-h-[10.5rem]"
          >
            <div className="flex items-center gap-2.5">
              <span className="num text-xs text-muted-foreground">
                {pad(number)}/{ORDER.length}
              </span>
              <span className="eyebrow">{t.lab.groups[stage.group].name}</span>
              <span className={cn(TAG, "ml-auto", by === "model" ? "border-query/50 text-query" : "border-border")}>{t.lab.by[by].tag}</span>
            </div>
            <h3 className="mt-2.5 flex items-center gap-2 text-lg font-medium tracking-tight">
              <Icon className="size-[1.1em] shrink-0 text-query" aria-hidden />
              {t.stages[active].name}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.stages[active].what}</p>
            {stage.formula && (
              <div className="mt-auto pt-3">
                <p className="num scrollbar-none overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs whitespace-pre" title={t.lab.formula}>
                  {stage.formula}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </figure>
  );
}
