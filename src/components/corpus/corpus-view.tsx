"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/site/segmented";
import { useT } from "@/i18n/LocaleProvider";
import { SPRING } from "@/lib/motion";
import { isHeading } from "@/lib/rag/chunk";
import { row } from "@/lib/rag/similarity";
import type { Chunk, Doc, Index } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { slotOf } from "@/lib/store/playhead";
import { useRevealed } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";
import { VectorStrip } from "./vector-strip";

interface Segment {
  start: number;
  end: number;
  /** The chunks that cover it: none (a gap), one, or two where passages overlap. */
  chunks: number[];
}

/** The document as runs of text, each covered by the same set of chunks. */
function segments(doc: Doc, chunks: Chunk[]): Segment[] {
  const edges = new Set<number>([0, doc.text.length]);
  for (const chunk of chunks) {
    edges.add(chunk.start);
    edges.add(chunk.end);
  }
  const sorted = [...edges].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    out.push({ start, end, chunks: chunks.filter((chunk) => chunk.start <= start && chunk.end >= end).map((chunk) => chunk.index) });
  }
  return out;
}

/**
 * A PDF breaks a paragraph at the end of every printed line. For reading,
 * those breaks are shown as spaces; the ones that end a sentence, or sit
 * next to a heading or a list item, stay. One character for one, so every
 * position in the text is still where the chunks say it is.
 */
function softBreaks(text: string): Set<number> {
  const soft = new Set<number>();
  let lineStart = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "\n") continue;
    const before = text.slice(lineStart, i);
    const nextEnd = text.indexOf("\n", i + 1);
    const after = text.slice(i + 1, nextEnd < 0 ? text.length : nextEnd);
    const hard = !before.trim() || !after.trim() || /[.:;!?]$/.test(before.trim()) || isHeading(before) || isHeading(after) || /^(- |\d+[.)] |_)/.test(after);
    if (!hard) soft.add(i);
    lineStart = i + 1;
  }
  return soft;
}

function shownText(text: string, start: number, end: number, soft: Set<number>): string {
  let out = "";
  for (let i = start; i < end; i++) out += soft.has(i) ? " " : text[i];
  return out;
}

/**
 * Indexing, as it happens: the document on the left, cut into passages as
 * the chunking plays (each one tinted, overlaps darker), and the passages
 * on the right, each with its vector once it is embedded. Pointing at a
 * passage on one side lights it on the other.
 */
export function CorpusView({ index }: { index: Index }) {
  const t = useT();
  const hovered = useLab((state) => state.hovered);
  const hover = useLab((state) => state.hover);
  const [docId, setDocId] = useState(index.docs[0]?.id);
  const doc = index.docs.find((candidate) => candidate.id === docId) ?? index.docs[0];
  const chunks = useMemo(() => index.chunks.filter((chunk) => chunk.docId === doc?.id), [index, doc]);
  const runs = useMemo(() => (doc ? segments(doc, chunks) : []), [doc, chunks]);
  const soft = useMemo(() => softBreaks(doc?.text ?? ""), [doc]);
  const first = chunks[0]?.index ?? 0;

  const cut = useRevealed(slotOf("chunk"), chunks.length);
  const embedded = useRevealed(slotOf("embed"), chunks.length);
  const text = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const from = useRef<"text" | "list" | null>(null);

  // Whichever side the pointer is not on scrolls the passage into view.
  useEffect(() => {
    if (hovered === null) return;
    const target = from.current === "text" ? list.current?.querySelector(`[data-chunk="${hovered}"]`) : text.current?.querySelector(`[data-chunks~="${hovered}"]`);
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [hovered]);

  if (!doc) return null;
  return (
    <div className="grid h-full min-h-0 gap-px bg-border lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="flex min-h-0 flex-col bg-background">
        <header className="flex h-10 shrink-0 items-center gap-3 px-5">
          <h3 className="eyebrow">{t.lab.corpus.document}</h3>
          {index.docs.length > 1 ? (
            <Segmented label={t.lab.corpus.document} value={doc.id} onChange={setDocId} options={index.docs.map((candidate) => ({ value: candidate.id, label: candidate.name.replace(/\.[a-z]+$/i, "").slice(0, 18), title: candidate.name }))} />
          ) : (
            <span className="num truncate text-xs text-muted-foreground">{doc.name}</span>
          )}
        </header>
        <div ref={text} className="fade-y scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8" onPointerLeave={() => hover(null)}>
          <p className="max-w-[68ch] text-[0.9375rem] leading-7 whitespace-pre-wrap" lang="pt-BR">
            {runs.map((run) => {
              const shown = run.chunks.filter((chunk) => chunk - first < cut);
              const lit = hovered !== null && shown.includes(hovered);
              const overlap = shown.length > 1;
              return (
                <span
                  key={`${run.start}-${run.end}`}
                  data-chunks={shown.join(" ")}
                  title={overlap ? t.lab.corpus.overlap : undefined}
                  onPointerEnter={() => {
                    from.current = "text";
                    hover(shown.length ? shown[shown.length - 1] : null);
                  }}
                  className={cn(
                    "box-decoration-clone rounded-[3px] py-[3px] transition-colors duration-300",
                    shown.length === 0 && "text-muted-foreground",
                    shown.length === 1 && (shown[0] % 2 === 0 ? "bg-corpus/10" : "bg-corpus/[0.18]"),
                    overlap && "bg-corpus/30 underline decoration-corpus/60 decoration-dotted underline-offset-4",
                    lit && "bg-query/20 text-foreground",
                  )}
                >
                  {shownText(doc.text, run.start, run.end, soft)}
                </span>
              );
            })}
          </p>
        </div>
      </section>

      <section className="flex min-h-0 flex-col bg-background">
        <header className="flex h-10 shrink-0 items-center justify-between gap-3 px-4">
          <h3 className="eyebrow">{t.lab.corpus.passages(cut)}</h3>
        </header>
        <ol ref={list} className="fade-y scrollbar-none flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2 pb-8" onPointerLeave={() => hover(null)}>
          <AnimatePresence initial={false}>
            {chunks.slice(0, cut).map((chunk) => {
              const lit = hovered === chunk.index;
              const hasVector = chunk.index - first < embedded;
              return (
                <motion.li
                  key={chunk.id}
                  data-chunk={chunk.index}
                  layout="position"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                  onPointerEnter={() => {
                    from.current = "list";
                    hover(chunk.index);
                  }}
                  className={cn("flex flex-col gap-1.5 rounded-lg border px-3 py-2 transition-colors duration-200", lit ? "border-query/60 bg-query/[0.07]" : "border-border bg-card")}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="num text-[0.6875rem] text-muted-foreground">#{chunk.index}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium" lang="pt-BR">
                      {chunk.title ?? chunk.text.slice(0, 40)}
                    </span>
                  </div>
                  <div className="h-2" title={t.lab.corpus.vector}>
                    {hasVector && (
                      <motion.div initial={{ opacity: 0, scaleX: 0.2 }} animate={{ opacity: 1, scaleX: 1 }} transition={SPRING} className="origin-left">
                        <VectorStrip vector={row(index.vectors, index.model.dims, chunk.index)} />
                      </motion.div>
                    )}
                  </div>
                  <div className="num flex gap-3 text-[0.6875rem] text-muted-foreground">
                    <span>{t.lab.corpus.chars(chunk.text.length)}</span>
                    {hasVector && chunk.tokens !== null && <span>{t.lab.corpus.tokens(chunk.tokens)}</span>}
                    {hasVector && chunk.truncated && <span className="text-flag">{t.lab.corpus.truncated}</span>}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </section>
    </div>
  );
}
