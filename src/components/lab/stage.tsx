"use client";

import { AnimatePresence, motion } from "motion/react";
import { CorpusView } from "@/components/corpus/corpus-view";
import { STAGE_ICONS } from "@/components/pipeline/stage-icons";
import { RetrieverView } from "@/components/retriever/retriever-view";
import { useT } from "@/i18n/LocaleProvider";
import { MODELS } from "@/lib/embed/models";
import { FADE, SPRING } from "@/lib/motion";
import { stageOf, usesModel } from "@/lib/rag/stages";
import { stepOf, type Step } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { INGEST_SLOTS, SLOTS } from "@/lib/store/playhead";
import { useCurrentSlot } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";
import { Tag } from "./panel";

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(0);

/**
 * The centre of the lab. A strip at the top says which stage the run is
 * in, what it does and the expression it computes, with the time it really
 * took; under it, the view of that part of the pipeline: the corpus while
 * indexing, the retriever while answering. Before there is an index, the
 * strip's place is taken by what is being waited for.
 */
export function Stage({ className }: { className?: string }) {
  const t = useT();
  const phase = useLab((state) => state.phase);
  const failure = useLab((state) => state.failure);
  const download = useLab((state) => state.download);
  const embedding = useLab((state) => state.embedding);
  const index = useLab((state) => state.index);
  const ingestTrace = useLab((state) => state.ingestTrace);
  const queryTrace = useLab((state) => state.queryTrace);
  const model = useLab((state) => state.settings.embed);
  const slot = useCurrentSlot();
  const stages = SLOTS[slot];
  const view = slot < INGEST_SLOTS || !queryTrace ? "corpus" : "retriever";
  const trace: readonly Step[] = slot < INGEST_SLOTS ? ingestTrace : (queryTrace ?? []);

  return (
    <section className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex min-h-[4.25rem] shrink-0 items-center border-b border-border px-5 py-2.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={slot} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="flex w-full flex-wrap items-center gap-x-8 gap-y-2">
            {stages.map((id) => {
              const Icon = STAGE_ICONS[id];
              const step = trace.find((candidate) => candidate.kind === id);
              const by = usesModel(id) ? t.lab.by.model : t.lab.by.code;
              const formula = stageOf(id).formula;
              return (
                <div key={id} className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-query" />
                    <h2 className="text-sm font-semibold tracking-tight">{t.stages[id].name}</h2>
                    <Tag title={by.hint} className={usesModel(id) ? "border-query/40 text-query" : undefined}>
                      {by.tag}
                    </Tag>
                    {step && <span className="num text-[0.6875rem] text-muted-foreground">{step.ms < 10 ? step.ms.toFixed(1) : Math.round(step.ms)} ms</span>}
                    {formula && <code className="num ml-auto hidden max-w-[55%] truncate text-[0.6875rem] text-muted-foreground 2xl:block" title={formula}>{formula}</code>}
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.stages[id].what}</p>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </header>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "error" ? (
            <Waiting key="error" title={t.lab.phase.error} detail={failure ?? ""} hint={t.lab.phase.retry} tone="flag" />
          ) : !index ? (
            phase === "model" ? (
              <Waiting
                key="model"
                title={t.lab.phase.model}
                detail={download ? t.lab.phase.downloaded(megabytes(download.loaded), megabytes(download.total)) : model.model}
                hint={t.lab.phase.modelHint(MODELS[model.model].size[model.dtype])}
                progress={download && download.total ? download.loaded / download.total : null}
              />
            ) : phase === "indexing" ? (
              <Waiting key="indexing" title={t.lab.phase.indexing} detail={embedding ? t.lab.phase.embedding(embedding.done, embedding.total) : ""} progress={embedding ? embedding.done / Math.max(1, embedding.total) : null} />
            ) : (
              <Waiting key="loading" title={t.lab.phase.loading} detail="" progress={null} />
            )
          ) : view === "corpus" ? (
            <motion.div key="corpus" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985 }} transition={SPRING} className="absolute inset-0">
              <CorpusView index={index} />
              <Facts ingest />
            </motion.div>
          ) : (
            <motion.div key="retriever" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985 }} transition={SPRING} className="absolute inset-0">
              <RetrieverView index={index} trace={queryTrace!} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** What the indexing found, once: a line floating at the foot of the corpus view. */
function Facts({ ingest }: { ingest: boolean }) {
  const t = useT();
  const trace = useLab((state) => state.ingestTrace);
  const slot = useCurrentSlot();
  const cleaned = stepOf(trace, "clean");
  const embedded = stepOf(trace, "embed");
  const indexed = stepOf(trace, "index");
  const number = (value: number) => value.toLocaleString(t.lang);
  const text =
    slot <= 1 && cleaned
      ? t.lab.corpus.cleaned(number(cleaned.before), number(cleaned.after))
      : slot === 3 && embedded
        ? t.lab.corpus.cached(embedded.embedded, embedded.cached)
        : slot >= 4 && indexed
          ? t.lab.corpus.indexed(indexed.chunks, indexed.dims, indexed.terms)
          : null;
  if (!ingest) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <AnimatePresence mode="wait">
        {text && (
          <motion.span key={text} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={SPRING} className="glass num rounded-full border border-border px-3 py-1.5 text-xs shadow-[var(--shadow-float)]">
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Waiting({ title, detail, hint, progress, tone }: { title: string; detail: string; hint?: string; progress?: number | null; tone?: "flag" }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="absolute inset-0 grid place-items-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-3 text-center">
        <p className={cn("text-base font-medium tracking-tight", tone === "flag" && "text-flag")}>{title}</p>
        {progress !== undefined && (
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            {progress === null ? (
              <div className="h-full w-1/3 animate-[breathe_1.2s_ease-in-out_infinite] rounded-full bg-query" />
            ) : (
              <motion.div className="h-full w-full origin-left rounded-full bg-query" animate={{ scaleX: Math.max(0.02, Math.min(1, progress)) }} transition={SPRING} />
            )}
          </div>
        )}
        {detail && <p className="num text-xs break-words text-muted-foreground">{detail}</p>}
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
    </motion.div>
  );
}
