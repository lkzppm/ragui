"use client";

import { LayoutGroup, motion, useTransform } from "motion/react";
import { useId } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING } from "@/lib/motion";
import { RAIL, type StageGroup } from "@/lib/rag/stages";
import { stepOf, type IngestTrace, type QueryTrace, type StageId } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { cursor, INGEST_SLOTS, slotOf } from "@/lib/store/playhead";
import { cn } from "@/lib/utils";
import { STAGE_ICONS } from "./stage-icons";

const GROUPS: readonly StageGroup[] = ["ingest", "query"];

type NodeState = "idle" | "running" | "done" | "skipped" | "unused";

/** The one number a stage shows on the rail once it has run. */
function valueOf(stage: StageId, ingest: IngestTrace, query: QueryTrace | null): string | null {
  switch (stage) {
    case "load":
      return stepOf(ingest, "load")?.docs.length.toString() ?? null;
    case "clean":
      return stepOf(ingest, "clean")?.after.toLocaleString("en-US") ?? null;
    case "chunk":
      return stepOf(ingest, "chunk")?.count.toString() ?? null;
    case "embed": {
      const step = stepOf(ingest, "embed");
      return step ? `${step.embedded + step.cached}×${step.model.dims}` : null;
    }
    case "index":
      return stepOf(ingest, "index")?.terms.toLocaleString("en-US") ?? null;
    case "query":
      return stepOf(query, "query")?.tokens.toString() ?? null;
    case "dense":
      return stepOf(query, "dense")?.hits[0]?.score.toFixed(3) ?? null;
    case "sparse":
      return stepOf(query, "sparse")?.hits.length.toString() ?? null;
    case "fuse":
      return stepOf(query, "fuse")?.hits.length.toString() ?? null;
    case "diversify":
      return stepOf(query, "diversify")?.kept.length.toString() ?? null;
    case "gate": {
      const step = stepOf(query, "gate");
      return step ? (step.pass ? "✓" : "✕") : null;
    }
    case "assemble":
      return stepOf(query, "assemble")?.tokens.toString() ?? null;
    case "generate":
      return stepOf(query, "generate")?.usage?.outputTokens?.toString() ?? null;
    case "verify":
      return stepOf(query, "verify")?.citations.length.toString() ?? null;
  }
}

/**
 * The pipeline in order: indexing on one row, the question on the next.
 * One column per step in time; dense and keyword search share a column
 * because they run side by side. The cursor travels along it: a highlight
 * slides to the stage that is running, each connector fills as the run
 * passes through, and a finished stage keeps its number. Clicking a stage
 * moves the run to it.
 */
export function PipelineRail({ className }: { className?: string }) {
  const t = useT();
  const groupId = useId();
  const ingestTrace = useLab((state) => state.ingestTrace);
  const queryTrace = useLab((state) => state.queryTrace);
  const reached = useLab((state) => state.reached);
  const limit = useLab((state) => state.limit);
  const mode = useLab((state) => state.settings.retrieve.mode);
  const focus = useLab((state) => state.focus);

  const stateOf = (stage: StageId): NodeState => {
    const slot = slotOf(stage);
    if ((stage === "sparse" && mode === "dense") || (stage === "dense" && mode === "sparse")) return slot < reached ? "unused" : "idle";
    const trace = slot < INGEST_SLOTS ? ingestTrace : queryTrace;
    const ran = Boolean(trace?.some((step) => step.kind === stage));
    if (slot < reached) return ran ? "done" : "skipped";
    if (slot === reached && reached < limit) return "running";
    // Past a closed gate nothing runs.
    if (slot >= INGEST_SLOTS && queryTrace && !ran && slot + 1 > Math.ceil(limit) && reached >= Math.ceil(limit)) return "skipped";
    return "idle";
  };

  return (
    <LayoutGroup id={groupId}>
      <div className={cn("flex flex-col", className)}>
        {GROUPS.map((group) => (
          <div key={group} className="flex min-w-0 items-center gap-3 px-4 first:border-b first:border-border sm:px-5">
            <span className="eyebrow w-[4.75rem] shrink-0">{t.lab.groups[group].name}</span>
            <ol className="scrollbar-none flex min-w-0 flex-1 items-center overflow-x-auto py-2.5">
              {RAIL[group].map((column, index) => (
                <li key={column.join("+")} className="flex shrink-0 items-center">
                  {index > 0 && <Connector slot={slotOf(column[0])} />}
                  <div className="flex flex-col gap-1">
                    {column.map((id, row) => (
                      <Node
                        key={id}
                        id={id}
                        name={t.stages[id].name}
                        state={stateOf(id)}
                        value={valueOf(id, ingestTrace, queryTrace)}
                        // Two stages run in one slot; the sliding highlight follows the first.
                        shared={row === 0}
                        title={stateOf(id) === "skipped" ? t.lab.state.skipped : stateOf(id) === "unused" ? t.lab.state.unused : undefined}
                        onSelect={focus}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}

/** The hairline between two columns. It fills in the last fifth of the slot before it, as the run moves on. */
function Connector({ slot }: { slot: number }) {
  const fill = useTransform(cursor, [slot - 0.22, slot], [0, 1], { clamp: true });
  const head = useTransform(fill, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);
  const x = useTransform(fill, (value) => `${value * 100}%`);
  return (
    <span className="relative mx-0.5 block h-px w-4 shrink-0 bg-border xl:w-5" aria-hidden>
      <motion.span className="absolute inset-0 origin-left bg-query" style={{ scaleX: fill }} />
      {/* What travels: one bright cell at the front of the fill. */}
      <motion.span className="absolute -top-[2.5px] left-0 size-1.5 -translate-x-1/2 rounded-full bg-query shadow-[0_0_8px_var(--query)]" style={{ left: x, opacity: head }} />
    </span>
  );
}

function Node({
  id,
  name,
  state,
  value,
  shared,
  title,
  onSelect,
}: {
  id: StageId;
  name: string;
  state: NodeState;
  value: string | null;
  shared: boolean;
  title?: string;
  onSelect: (id: StageId) => void;
}) {
  const Icon = STAGE_ICONS[id];
  const running = state === "running";
  return (
    <button
      type="button"
      title={title}
      aria-current={running ? "step" : undefined}
      onClick={() => onSelect(id)}
      className={cn(
        "press relative inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium whitespace-nowrap",
        state === "idle" && "border-border text-muted-foreground/70 hover:text-foreground",
        state === "running" && "border-transparent text-foreground",
        state === "done" && "border-border text-foreground hover:bg-accent",
        state === "skipped" && "border-dashed border-border text-muted-foreground/50 line-through decoration-muted-foreground/40",
        state === "unused" && "border-dashed border-border text-muted-foreground/60",
      )}
    >
      {running &&
        (shared ? (
          <motion.span layoutId="rail-now" className="absolute -inset-px rounded-lg border border-query bg-query/10" transition={SPRING} aria-hidden />
        ) : (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -inset-px rounded-lg border border-query bg-query/10" aria-hidden />
        ))}
      <Icon className={cn("relative size-3.5 transition-colors duration-300", running && "text-query")} />
      <span className="relative">{name}</span>
      {value !== null && (state === "done" || state === "unused") && (
        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={SPRING} className="num relative text-[0.6875rem] text-muted-foreground">
          {value}
        </motion.span>
      )}
    </button>
  );
}
