"use client";

import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING } from "@/lib/motion";
import { stepOf, type Index, type QueryTrace } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { slotOf } from "@/lib/store/playhead";
import { useEntered, useRevealed } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";

interface RowData {
  chunk: number;
  rank: number;
  /** As printed. */
  score: string;
  /** 0..1, the length of the bar. */
  share: number;
  note?: string;
  state?: "kept" | "dropped" | "beyond";
  source?: number;
  ranks?: { dense: number | null; sparse: number | null };
}

/**
 * The three lists a question produces, side by side: by meaning, by words,
 * and the two together. Rows fill in as each search plays. Once the
 * diversity step has run, the fused list shows what was kept and what was
 * passed over, and the kept rows take their source number when the context
 * is packed. A passage under the pointer lights up in every list.
 */
export function Ranking({ index, trace }: { index: Index; trace: QueryTrace }) {
  const t = useT();
  const r = t.lab.retriever;
  const mode = useLab((state) => state.settings.retrieve.mode);
  const dense = stepOf(trace, "dense");
  const sparse = stepOf(trace, "sparse");
  const fused = stepOf(trace, "fuse");
  const diversified = stepOf(trace, "diversify");
  const assembled = stepOf(trace, "assemble");

  const denseShown = useRevealed(slotOf("dense"), dense?.hits.length ?? 0);
  const sparseShown = useRevealed(slotOf("sparse"), sparse?.hits.length ?? 0);
  const fusedShown = useRevealed(slotOf("fuse"), fused?.hits.length ?? 0);
  const searched = useEntered(slotOf("sparse"));
  const chosen = useEntered(slotOf("diversify")) && Boolean(diversified);
  const numbered = useEntered(slotOf("assemble")) && Boolean(assembled);

  let low = Infinity;
  let high = -Infinity;
  for (const score of dense?.scores ?? []) {
    low = Math.min(low, score);
    high = Math.max(high, score);
  }
  const denseRows: RowData[] = (dense?.hits ?? []).slice(0, denseShown).map((hit) => ({
    chunk: hit.chunk,
    rank: hit.rank,
    score: hit.score.toFixed(3),
    share: 0.12 + 0.88 * ((hit.score - low) / Math.max(1e-6, high - low)),
  }));
  const topSparse = sparse?.hits[0]?.score ?? 1;
  const sparseRows: RowData[] = (sparse?.hits ?? []).slice(0, sparseShown).map((hit) => ({
    chunk: hit.chunk,
    rank: hit.rank,
    score: hit.score.toFixed(2),
    share: hit.score / topSparse,
    note: hit.matched.map((match) => match.term).join(" · "),
  }));
  const keptRank = new Map(diversified?.kept.map((hit) => [hit.chunk, hit.rank]));
  const dropped = new Map(diversified?.dropped.map((hit) => [hit.chunk, hit.tooCloseTo]));
  const sourceOf = new Map<number, number>();
  for (const source of assembled?.sources ?? []) for (const chunk of source.chunks) sourceOf.set(chunk, source.n);
  const topFused = fused?.hits[0]?.score ?? 1;
  const fusedRows: RowData[] = (fused?.hits ?? []).slice(0, fusedShown).map((hit) => ({
    chunk: hit.chunk,
    rank: hit.rank,
    score: mode === "hybrid" ? hit.score.toFixed(4) : hit.score.toFixed(3),
    share: hit.score / topFused,
    ranks: { dense: hit.denseRank, sparse: hit.sparseRank },
    state: !chosen ? undefined : keptRank.has(hit.chunk) ? "kept" : dropped.has(hit.chunk) ? "dropped" : "beyond",
    note: chosen && dropped.has(hit.chunk) ? r.dropped(dropped.get(hit.chunk)!) : undefined,
    source: numbered ? sourceOf.get(hit.chunk) : undefined,
  }));

  return (
    <div className="grid h-full min-h-0 grid-cols-3 gap-px bg-border">
      <Column title={r.dense} rows={denseRows} index={index} dim={mode === "sparse"} dimNote={t.lab.state.unused} />
      <Column
        title={r.sparse}
        rows={sparseRows}
        index={index}
        dim={mode === "dense"}
        dimNote={t.lab.state.unused}
        empty={searched && sparse?.hits.length === 0 ? r.noSparse : undefined}
        above={
          searched && sparse ? (
            <ul className="flex flex-wrap gap-1 px-3 pb-2" aria-label={r.terms}>
              {sparse.terms.map((term) => (
                <li
                  key={term.term}
                  title={term.df ? `${r.inPassages(term.df)} · ${r.weight} ${term.idf.toFixed(2)}` : r.absent}
                  className={cn("num rounded-md border px-1.5 py-0.5 text-[0.6875rem]", term.df ? "border-border text-foreground" : "border-dashed border-border text-muted-foreground line-through")}
                  style={term.df ? { opacity: 0.45 + 0.55 * Math.min(1, term.idf / 2.5) } : undefined}
                >
                  {term.term}
                </li>
              ))}
            </ul>
          ) : null
        }
      />
      <Column title={r.fused} rows={fusedRows} index={index} accent />
    </div>
  );
}

function Column({
  title,
  rows,
  index,
  dim = false,
  dimNote,
  empty,
  above,
  accent = false,
}: {
  title: string;
  rows: RowData[];
  index: Index;
  dim?: boolean;
  dimNote?: string;
  empty?: string;
  above?: React.ReactNode;
  accent?: boolean;
}) {
  const hovered = useLab((state) => state.hovered);
  const hover = useLab((state) => state.hover);
  return (
    <section className={cn("flex min-h-0 flex-col bg-background transition-opacity duration-300", dim && "opacity-45")} title={dim ? dimNote : undefined}>
      <header className="flex h-10 shrink-0 items-center gap-2 px-3">
        <h3 className={cn("eyebrow", accent && "text-query")}>{title}</h3>
      </header>
      {above}
      {empty && <p className="px-3 text-xs text-muted-foreground">{empty}</p>}
      <ol className="fade-y scrollbar-none flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pt-1 pb-6" onPointerLeave={() => hover(null)}>
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((row) => {
            const chunk = index.chunks[row.chunk];
            const lit = hovered === row.chunk;
            return (
              <motion.li
                key={row.chunk}
                layout
                initial={{ opacity: 0, x: accent ? -18 : 0, y: accent ? 0 : 6 }}
                animate={{ opacity: row.state === "beyond" ? 0.4 : row.state === "dropped" ? 0.55 : 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={SPRING}
                onPointerEnter={() => hover(row.chunk)}
                className={cn(
                  "relative flex flex-col gap-1 rounded-lg border px-2 py-1.5 transition-colors duration-200",
                  lit ? "border-query/60 bg-query/[0.07]" : row.state === "kept" ? "border-query/40 bg-card" : "border-border bg-card",
                )}
              >
                <div className="flex items-baseline gap-1.5 text-xs">
                  <span className="num w-3 shrink-0 text-muted-foreground">{row.rank}</span>
                  <span className={cn("min-w-0 flex-1 truncate font-medium", row.state === "dropped" && "line-through decoration-flag/60")} lang="pt-BR" title={chunk.title ?? chunk.text.slice(0, 80)}>
                    {chunk.title ?? chunk.text.slice(0, 40)}
                  </span>
                  <AnimatePresence>
                    {row.source !== undefined && (
                      <motion.span key="n" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", bounce: 0.3, duration: 0.45 }} className="num rounded bg-query px-1 text-[0.625rem] font-medium text-query-foreground">
                        {row.source}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.span
                      className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", accent || row.state === "kept" ? "bg-query" : "bg-corpus")}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: Math.max(0.02, Math.min(1, row.share)) }}
                      transition={SPRING}
                    />
                  </span>
                  <span className="num shrink-0 text-[0.625rem] text-muted-foreground">{row.score}</span>
                </div>
                {(row.ranks || row.note) && (
                  <div className="num flex min-w-0 gap-2 text-[0.625rem] text-muted-foreground">
                    {row.ranks && (
                      <span className="shrink-0">
                        {row.ranks.dense ?? "–"} + {row.ranks.sparse ?? "–"}
                      </span>
                    )}
                    {row.note && <span className={cn("truncate", row.state === "dropped" && "text-flag")}>{row.note}</span>}
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
