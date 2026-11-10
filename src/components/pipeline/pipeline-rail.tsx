"use client";

import { LayoutGroup, motion } from "motion/react";
import { useId } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { RAIL, STAGES, type StageGroup } from "@/lib/rag/stages";
import type { StageId } from "@/lib/rag/types";
import { cn } from "@/lib/utils";
import { STAGE_ICONS } from "./stage-icons";

const GROUPS: readonly StageGroup[] = ["ingest", "query"];
const NUMBER = new Map(STAGES.map((stage, index) => [stage.id, index + 1]));

interface PipelineRailProps {
  /** The stage whose inspector is open. */
  selected?: StageId;
  /** Without it the rail is a figure: nothing can be picked. */
  onSelect?: (id: StageId) => void;
  className?: string;
}

/**
 * The pipeline in order: indexing on one row, the question on the next (the
 * two together are wider than a laptop). One column per step in time; dense
 * and keyword search share a column because they run side by side. For now every stage is at rest. Once a run returns a trace, this is
 * where its packets travel and its numbers count up.
 */
export function PipelineRail({ selected, onSelect, className }: PipelineRailProps) {
  const t = useT();
  // One highlight per rail, so two rails on a page never trade it.
  const groupId = useId();
  return (
    <LayoutGroup id={groupId}>
      <div className={cn("flex flex-col gap-3", className)}>
        {GROUPS.map((group) => (
          <div key={group} className="min-w-0 rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-4 py-2.5">
              <span className="eyebrow">{t.lab.groups[group].name}</span>
              <span className="text-xs text-muted-foreground">{t.lab.groups[group].hint}</span>
            </div>
            <ol className="scrollbar-none flex items-center overflow-x-auto px-4 py-4">
              {RAIL[group].map((column, index) => (
                <li key={column.join("+")} className="flex shrink-0 items-center">
                  {index > 0 && <span className="h-px w-4 bg-border lg:w-5" aria-hidden />}
                  <div className="flex flex-col gap-1.5">
                    {column.map((id) => (
                      <Node key={id} id={id} name={t.stages[id].name} active={selected === id} onSelect={onSelect} />
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

function Node({ id, name, active, onSelect }: { id: StageId; name: string; active: boolean; onSelect?: (id: StageId) => void }) {
  const Icon = STAGE_ICONS[id];
  const className = cn(
    "relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
    active ? "text-foreground" : "text-muted-foreground",
    onSelect && !active && "hover:bg-accent hover:text-foreground",
  );
  const content = (
    <>
      {active && (
        <motion.span
          layoutId="selected-stage"
          className="absolute -inset-px rounded-lg border border-query bg-query/10"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          aria-hidden
        />
      )}
      <span className="num relative text-[0.625rem] opacity-60">{String(NUMBER.get(id)).padStart(2, "0")}</span>
      <Icon className="relative size-3.5" />
      <span className="relative">{name}</span>
    </>
  );
  if (!onSelect) return <span className={className}>{content}</span>;
  return (
    <button type="button" aria-pressed={active} onClick={() => onSelect(id)} className={className}>
      {content}
    </button>
  );
}
