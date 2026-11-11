"use client";

import { ChevronLeft, FileUp, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { CorpusView } from "@/components/corpus/corpus-view";
import { STAGE_ICONS } from "@/components/pipeline/stage-icons";
import { RetrieverView } from "@/components/retriever/retriever-view";
import { useT } from "@/i18n/LocaleProvider";
import { MODELS } from "@/lib/embed/models";
import { FADE, SPRING } from "@/lib/motion";
import { stageOf, usesModel } from "@/lib/rag/stages";
import { stepOf, type Step } from "@/lib/rag/types";
import { ATTEMPTS, useLab } from "@/lib/store/lab";
import { INGEST_SLOTS, SLOTS } from "@/lib/store/playhead";
import { useCurrentSlot } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";
import { Tag } from "./panel";

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(0);

/**
 * A duration in the unit that fits it. Most stages are a few microseconds
 * of plain code; the ones that run a model take milliseconds.
 */
function duration(ms: number, lang: string): string {
  const number = (value: number, digits: number) => value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (ms >= 10) return `${number(ms, 0)} ms`;
  if (ms >= 1) return `${number(ms, 1)} ms`;
  const micro = ms * 1000;
  if (micro >= 10) return `${number(micro, 0)} µs`;
  if (micro >= 1) return `${number(micro, 1)} µs`;
  return "< 1 µs";
}

/** True when the stage only handed back vectors it already had: its time says nothing about the model. */
function fromCache(step: Step): boolean {
  return (step.kind === "query" && step.cached) || (step.kind === "embed" && step.embedded === 0);
}

/**
 * The centre of the lab. A strip at the top names the stage the run is in,
 * who computes it and the time it really took; what it does and the
 * expression behind it wait in a tooltip. Under it, the view of that part
 * of the pipeline: the corpus while indexing, the retriever while
 * answering. Before there is an index, that place says what is being
 * waited for, or asks for a first document.
 */
export function Stage({ className }: { className?: string }) {
  const t = useT();
  const phase = useLab((state) => state.phase);
  const failure = useLab((state) => state.failure);
  const download = useLab((state) => state.download);
  const attempt = useLab((state) => state.attempt);
  const retry = useLab((state) => state.retry);
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
      <header className="flex h-11 shrink-0 items-center border-b border-border px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={slot} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="flex w-full items-center gap-x-8">
            {stages.map((id) => {
              const Icon = STAGE_ICONS[id];
              const step = trace.find((candidate) => candidate.kind === id);
              const by = usesModel(id) ? t.lab.by.model : t.lab.by.code;
              const formula = stageOf(id).formula;
              return (
                <div key={id} className="flex min-w-0 flex-1 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-query" />
                  <h2 className="truncate text-sm font-semibold tracking-tight">{t.stages[id].name}</h2>
                  <Tag title={by.hint} className={cn("shrink-0", usesModel(id) && "border-query/40 text-query")}>
                    {by.tag}
                  </Tag>
                  {step && (
                    <span className="num shrink-0 text-[0.6875rem] text-muted-foreground" title={fromCache(step) ? t.lab.cachedHint : undefined}>
                      {fromCache(step) ? t.lab.cached : duration(step.ms, t.lang)}
                    </span>
                  )}
                  <InfoTip label={t.lab.about(t.stages[id].name)}>
                    <p>{t.stages[id].what}</p>
                    <p className="text-muted-foreground">{by.hint}</p>
                    {formula && (
                      <div className="flex flex-col gap-1 border-t border-border pt-2">
                        <span className="eyebrow">{t.lab.formula}</span>
                        <code className="num text-[0.6875rem] break-words text-muted-foreground">{formula}</code>
                      </div>
                    )}
                  </InfoTip>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </header>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "error" ? (
            <Waiting key="error" title={t.lab.phase.error} detail={failure ?? ""} tone="flag">
              <button type="button" onClick={retry} className="press mx-auto inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background">
                <RotateCcw className="size-4" />
                {t.lab.phase.again}
              </button>
            </Waiting>
          ) : phase === "missing" ? (
            <Waiting key="missing" title={t.lab.explorer.missingTitle} detail="" hint={t.lab.explorer.missingBody}>
              <Link href="/lab" className="press mx-auto inline-flex h-9 items-center gap-1 rounded-full bg-foreground pr-4 pl-3 text-sm font-medium text-background">
                <ChevronLeft className="size-4" />
                {t.lab.explorer.back}
              </Link>
            </Waiting>
          ) : phase === "empty" ? (
            <Empty key="empty" />
          ) : !index ? (
            phase === "model" ? (
              <Waiting
                key="model"
                title={t.lab.phase.model}
                detail={download ? t.lab.phase.downloaded(megabytes(download.loaded), megabytes(download.total)) : model.model}
                hint={attempt > 1 ? t.lab.phase.retrying(attempt, ATTEMPTS) : t.lab.phase.modelHint(MODELS[model.model].size[model.dtype])}
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

function Waiting({ title, detail, hint, progress, tone, children }: { title: string; detail: string; hint?: string; progress?: number | null; tone?: "flag"; children?: ReactNode }) {
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
        {children && <div className="mt-2 flex">{children}</div>}
      </div>
    </motion.div>
  );
}

/** A dataset with nothing in it: the whole stage is the place to drop a first document. */
function Empty() {
  const t = useT();
  const addFiles = useLab((state) => state.addFiles);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [unread, setUnread] = useState(false);

  const take = async (files: FileList | null) => {
    if (!files?.length) return;
    await addFiles([...files]);
    setUnread(useLab.getState().docs.length === 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={SPRING}
      className="absolute inset-0 p-5"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      }}
      onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        void take(event.dataTransfer.files);
      }}
    >
      <div className={cn("grid h-full place-items-center rounded-2xl border-2 border-dashed p-6 transition-colors duration-300", over ? "border-query bg-query/5" : "border-border")}>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <motion.span animate={{ y: over ? -6 : 0, scale: over ? 1.08 : 1 }} transition={SPRING} className="grid size-12 place-items-center rounded-2xl bg-query/12 text-query">
            <FileUp className="size-6" />
          </motion.span>
          <p className="text-base font-medium tracking-tight">{t.lab.explorer.emptyTitle}</p>
          <p className={cn("text-sm leading-relaxed", unread ? "text-flag" : "text-muted-foreground")}>{unread ? t.lab.sidebar.noText : t.lab.explorer.emptyBody}</p>
          <input ref={input} type="file" multiple accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" className="sr-only" onChange={(event) => void take(event.target.files).then(() => (event.target.value = ""))} />
          <button type="button" onClick={() => input.current?.click()} className="press mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background">
            <FileUp className="size-4" />
            {t.lab.sidebar.add}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
