"use client";

import { ShieldOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING, SPRING_DROP } from "@/lib/motion";
import { stepOf, type Index, type QueryTrace } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { slotOf } from "@/lib/store/playhead";
import { useEntered, useRevealed } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";

/**
 * What reaches the model, as a bar as wide as the token budget. Each
 * source drops in as a block sized by its tokens; what did not fit waits
 * outside. Before it, the gate: the closest passage against the
 * threshold. When the gate is closed there is no bar at all.
 */
export function ContextTray({ index, trace }: { index: Index; trace: QueryTrace }) {
  const t = useT();
  const r = t.lab.retriever;
  const hovered = useLab((state) => state.hovered);
  const hover = useLab((state) => state.hover);
  const gate = stepOf(trace, "gate");
  const assembled = stepOf(trace, "assemble");
  const gated = useEntered(slotOf("gate")) && Boolean(gate);
  const shown = useRevealed(slotOf("assemble"), assembled?.sources.length ?? 0);
  const packing = useEntered(slotOf("assemble")) && Boolean(assembled);

  const closed = gated && gate && !gate.pass;
  const used = assembled?.sources.slice(0, shown).reduce((sum, source) => sum + source.tokens, 0) ?? 0;

  return (
    <section className="flex h-[6.75rem] shrink-0 flex-col justify-center gap-2 bg-background px-5">
      <AnimatePresence mode="wait" initial={false}>
        {closed ? (
          <motion.div key="closed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-flag/15 text-flag">
              <ShieldOff className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.gateClosedTitle}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {r.gateClosed(gate.best.toFixed(3), gate.threshold!.toFixed(3))} {r.gateClosedBody}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="eyebrow">{r.context}</h3>
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {gated && gate && (gate.threshold === null ? r.gateOff(gate.best.toFixed(3)) : r.gateOpen(gate.best.toFixed(3), gate.threshold.toFixed(3)))}
              </span>
              {packing && assembled && <span className="num shrink-0 text-xs">{r.budget(used, assembled.budget)}</span>}
            </div>
            <div className="flex h-9 items-stretch gap-2">
              <div className="relative flex min-w-0 flex-1 items-stretch gap-0.5 overflow-hidden rounded-lg border border-border bg-muted/50 p-0.5">
                <AnimatePresence initial={false}>
                  {packing &&
                    assembled?.sources.slice(0, shown).map((source) => {
                      const lit = hovered !== null && source.chunks.includes(hovered);
                      return (
                        <motion.button
                          key={source.chunks.join("+")}
                          type="button"
                          layout
                          initial={{ opacity: 0, y: -22 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={SPRING_DROP}
                          onPointerEnter={() => hover(source.chunks[0])}
                          onPointerLeave={() => hover(null)}
                          style={{ width: `${Math.max(6, (source.tokens / assembled.budget) * 100)}%` }}
                          title={`${source.title ?? ""} · ${source.tokens} tokens`}
                          className={cn("flex min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs transition-colors duration-200", lit ? "bg-query text-query-foreground" : "bg-query/15 text-foreground")}
                        >
                          <span className="num font-medium">{source.n}</span>
                          <span className="min-w-0 truncate" lang="pt-BR">{source.title ?? index.chunks[source.chunks[0]].text.slice(0, 30)}</span>
                          <span className="num ml-auto shrink-0 opacity-70">{source.tokens}</span>
                        </motion.button>
                      );
                    })}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {packing && shown === assembled?.sources.length && assembled.leftOut.length > 0 && (
                  <motion.div key="left" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING_DROP} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-flag/60 px-2 text-xs text-flag">
                    <span>{r.leftOut}</span>
                    <span className="num">{assembled.leftOut.map((hit) => `#${hit.chunk}`).join(" ")}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
