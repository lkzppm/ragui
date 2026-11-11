"use client";

import { Ban, Check, ChevronLeft, CornerDownLeft, ExternalLink, FileText, FileUp, FlaskConical, History, Layers2, Package, RotateCcw, Scissors, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Segmented } from "@/components/site/segmented";
import { useLocale } from "@/i18n/LocaleProvider";
import { FADE, SPRING } from "@/lib/motion";
import { RANGES, type ChunkStrategy, type ContextOrder, type RetrieveMode } from "@/lib/rag/settings";
import { useLab } from "@/lib/store/lab";
import { cn } from "@/lib/utils";
import { Group, IconButton, Slider } from "./controls";

type GroupKey = "documents" | "chunking" | "retrieval" | "context" | "tests";

const STRATEGIES: readonly ChunkStrategy[] = ["structure", "recursive", "fixed"];
const MODES: readonly RetrieveMode[] = ["hybrid", "dense", "sparse"];
const ORDERS: readonly ContextOrder[] = ["rank", "document"];

/**
 * The dataset on the left: its name and the way back to the others, the
 * questions asked of it, then its documents, every setting of the pipeline
 * in three groups, and its test questions when it has any. Of the groups
 * under the history one is open at a time. A change takes effect at once:
 * chunking re-indexes (only new passages are embedded), the rest re-runs
 * the search, and the tests are graded again.
 */
export function Sidebar({ className }: { className?: string }) {
  const { t, locale } = useLocale();
  const s = t.lab.sidebar;
  const sandbox = useLab((state) => state.sandbox);
  const settings = useLab((state) => state.settings);
  const docs = useLab((state) => state.docs);
  const index = useLab((state) => state.index);
  const tests = useLab((state) => state.tests);
  const question = useLab((state) => state.question);
  const history = useLab((state) => state.history);
  const forget = useLab((state) => state.forget);
  const clearHistory = useLab((state) => state.clearHistory);
  const update = useLab((state) => state.update);
  const addFiles = useLab((state) => state.addFiles);
  const removeDoc = useLab((state) => state.removeDoc);
  const ask = useLab((state) => state.ask);
  // Until the visitor picks a group: the tests of a dataset that has them, the documents of one that does not.
  const [picked, setOpen] = useState<GroupKey | null | undefined>(undefined);
  const open = picked === undefined ? (sandbox.golden.length ? "tests" : "documents") : picked;
  const [historyOpen, setHistoryOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [unread, setUnread] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toggle = (key: GroupKey) => setOpen(open === key ? null : key);

  const take = async (files: FileList | null) => {
    if (!files?.length) return;
    const before = useLab.getState().docs.length;
    await addFiles([...files]);
    setUnread(useLab.getState().docs.length === before);
  };

  const results = sandbox.golden.map((test) => tests[test.id]);
  const passed = results.filter((result) => result?.inContext).length;
  const changed = JSON.stringify(settings) !== JSON.stringify(sandbox.settings);
  const name = sandbox.preset ? t.presets[sandbox.id as keyof typeof t.presets]?.name : sandbox.name || (sandbox.id ? t.lab.explorer.untitled : "");
  const number = (value: number) => value.toLocaleString(t.lang);

  return (
    <aside
      className={cn("relative flex min-h-0 flex-col border-border bg-card lg:border-r", className)}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
        setOpen("documents");
      }}
      onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void take(event.dataTransfer.files);
      }}
    >
      <header className="flex flex-col gap-1 border-b border-border px-2.5 pt-2.5 pb-3.5">
        <div className="flex items-center">
          <Link href="/lab" aria-label={t.lab.explorer.backLabel} title={t.lab.explorer.backLabel} className="press group inline-flex h-7 items-center gap-0.5 rounded-lg pr-2.5 pl-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
            <ChevronLeft className="size-4 transition-transform duration-300 ease-[var(--ease)] group-hover:-translate-x-0.5" />
            {t.lab.explorer.back}
          </Link>
          <AnimatePresence>
            {changed && (
              <motion.span key="reset" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={SPRING} className="ml-auto">
                <IconButton label={s.reset} onClick={() => update(sandbox.settings)} className="size-7">
                  <RotateCcw className="size-3.5" />
                </IconButton>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <h1 className="min-h-6 truncate px-1.5 text-lg leading-tight font-semibold tracking-tight" title={name}>
          {name}
        </h1>
      </header>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <Group icon={History} title={s.history} summary={history.length || undefined} open={historyOpen} onToggle={() => setHistoryOpen(!historyOpen)}>
          {history.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{s.historyEmpty}</p>
          ) : (
            <>
              <ol className="scrollbar-none -mx-1 -mt-1 flex max-h-56 flex-col overflow-y-auto">
                <AnimatePresence initial={false}>
                  {history.map((entry) => {
                    const active = question === entry.question;
                    return (
                      <motion.li key={entry.question} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} className="group/entry relative shrink-0 overflow-hidden">
                        <button
                          type="button"
                          disabled={!index}
                          onClick={() => void ask(entry.question, locale)}
                          title={entry.pass ? undefined : s.stopped}
                          className={cn("press flex w-full items-start gap-2 rounded-lg py-1.5 pr-8 pl-1 text-left hover:bg-accent disabled:opacity-50", active && "bg-accent")}
                        >
                          {entry.pass ? <CornerDownLeft className={cn("mt-0.5 size-3.5 shrink-0", active ? "text-query" : "text-muted-foreground/70")} /> : <Ban className="mt-0.5 size-3.5 shrink-0 text-flag" />}
                          <span className="line-clamp-2 min-w-0 text-[0.8125rem] leading-snug">{entry.question}</span>
                        </button>
                        <IconButton label={s.forget(entry.question)} onClick={() => forget(entry.question)} className="absolute top-1 right-0.5 size-6 opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100 max-lg:opacity-60">
                          <X className="size-3" />
                        </IconButton>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
              <button type="button" onClick={clearHistory} className="press -my-1 self-start rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                {s.historyClear}
              </button>
            </>
          )}
        </Group>

        {sandbox.golden.length > 0 && (
        <Group icon={FlaskConical} title={s.tests} summary={results.some(Boolean) ? s.score(passed, results.length) : undefined} open={open === "tests"} onToggle={() => toggle("tests")}>
          <p className="text-xs leading-relaxed text-muted-foreground">{s.testsHint}</p>
          <ol className="-mx-1 flex flex-col">
            {sandbox.golden.map((test) => {
              const result = tests[test.id];
              const active = question === test.question;
              return (
                <li key={test.id}>
                  <button
                    type="button"
                    disabled={!index}
                    onClick={() => void ask(test.question, locale)}
                    className={cn("press flex w-full items-start gap-2.5 rounded-lg px-1 py-2 text-left hover:bg-accent disabled:opacity-50", active && "bg-accent")}
                  >
                    <span
                      title={!result ? undefined : result.holders.length === 0 ? s.missing : result.inContext ? s.passed : s.failed}
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                        !result && "border-border",
                        result?.inContext && "border-query bg-query text-query-foreground",
                        result && !result.inContext && "border-flag text-flag",
                      )}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {result && (
                          <motion.span key={result.inContext ? "yes" : "no"} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING}>
                            {result.inContext ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm leading-snug">{test.question}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {s.expected}: <span className="num text-foreground/80">{test.expect}</span>
                      </span>
                      {result && (
                        <span className="num flex gap-2.5 text-[0.6875rem] text-muted-foreground">
                          <span>{s.rank.dense} {result.dense ?? "–"}</span>
                          <span>{s.rank.sparse} {result.sparse ?? "–"}</span>
                          <span className={cn(result.inContext ? "text-query" : "text-flag")}>{s.rank.fused} {result.fused ?? "–"}</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Group>
        )}

        <Group icon={Scissors} title={s.chunking} summary={index ? index.chunks.length : undefined} open={open === "chunking"} onToggle={() => toggle("chunking")}>
          <div className="flex flex-col gap-1.5">
            <Segmented
              label={t.knobs.strategy}
              value={settings.chunk.strategy}
              onChange={(strategy) => update({ chunk: { strategy } })}
              options={STRATEGIES.map((value) => ({ value, label: t.lab.options.strategy[value] }))}
              className="w-full [&>button]:flex-1"
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={settings.chunk.strategy} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="text-xs text-muted-foreground">
                {t.lab.options.strategyHint[settings.chunk.strategy]}
              </motion.p>
            </AnimatePresence>
          </div>
          <Slider label={t.knobs.size} value={settings.chunk.size} {...RANGES.size} onChange={(size) => update({ chunk: { size, overlap: Math.min(settings.chunk.overlap, Math.floor(size / 2)) } })} />
          <Slider label={t.knobs.overlap} value={settings.chunk.overlap} {...RANGES.overlap} max={Math.min(RANGES.overlap.max, Math.floor(settings.chunk.size / 2))} onChange={(overlap) => update({ chunk: { overlap } })} />
        </Group>

        <Group icon={Search} title={s.retrieval} summary={t.lab.options.mode[settings.retrieve.mode]} open={open === "retrieval"} onToggle={() => toggle("retrieval")}>
          <Segmented
            label={t.knobs.mode}
            value={settings.retrieve.mode}
            onChange={(mode) => update({ retrieve: { mode } })}
            options={MODES.map((value) => ({ value, label: t.lab.options.mode[value] }))}
            className="w-full [&>button]:flex-1"
          />
          <Slider label={t.knobs.k} value={settings.retrieve.k} {...RANGES.k} onChange={(k) => update({ retrieve: { k } })} />
          <Slider label={t.knobs.lambda} value={settings.retrieve.lambda} display={settings.retrieve.lambda.toFixed(2)} {...RANGES.lambda} onChange={(lambda) => update({ retrieve: { lambda } })} />
          <Slider
            label={t.knobs.threshold}
            value={settings.retrieve.threshold ?? RANGES.threshold.min}
            display={settings.retrieve.threshold === null ? s.gateOff : settings.retrieve.threshold.toFixed(3)}
            {...RANGES.threshold}
            onChange={(value) => update({ retrieve: { threshold: value <= RANGES.threshold.min ? null : value } })}
          />
        </Group>

        <Group icon={Package} title={s.context} summary={`${settings.context.sources} · ${settings.context.budget}`} open={open === "context"} onToggle={() => toggle("context")}>
          <Slider label={t.knobs.sources} value={settings.context.sources} {...RANGES.sources} onChange={(sources) => update({ context: { sources } })} />
          <Slider label={t.knobs.budget} value={settings.context.budget} {...RANGES.budget} onChange={(budget) => update({ context: { budget } })} />
          <Segmented
            label={t.knobs.order}
            value={settings.context.order}
            onChange={(order) => update({ context: { order } })}
            options={ORDERS.map((value) => ({ value, label: t.lab.options.order[value] }))}
            className="w-full [&>button]:flex-1"
          />
        </Group>

        <Group icon={Layers2} title={s.documents} summary={docs.length || undefined} open={open === "documents"} onToggle={() => toggle("documents")}>
          <ul className="-mx-1 flex flex-col">
            <AnimatePresence initial={false}>
              {docs.map((doc) => {
                const bundled = sandbox.documents.find((document) => document.name === doc.name);
                return (
                  <motion.li key={doc.name} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} className="overflow-hidden">
                    <div className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                      <FileText className="size-4 shrink-0 text-corpus" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="num truncate text-xs" title={doc.name}>
                          {doc.name}
                        </span>
                        <span className="text-[0.6875rem] text-muted-foreground">{s.chars(number(doc.text.length))}</span>
                      </span>
                      {bundled?.url && (
                        <a href={bundled.url} target="_blank" rel="noreferrer noopener" title={s.open(doc.name)} aria-label={s.open(doc.name)} className="press grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {(docs.length > 1 || !sandbox.preset) && (
                        <IconButton label={s.remove(doc.name)} onClick={() => removeDoc(doc.name)} className="size-7">
                          <X className="size-3.5" />
                        </IconButton>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          <input ref={input} type="file" multiple accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" className="sr-only" onChange={(event) => void take(event.target.files).then(() => (event.target.value = ""))} />
          <button type="button" onClick={() => input.current?.click()} className="press flex h-9 items-center justify-center gap-2 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground">
            <FileUp className="size-4" />
            {s.add}
          </button>
          <p className={cn("text-xs leading-relaxed", unread ? "text-flag" : "text-muted-foreground")}>{unread ? s.noText : s.addHint}</p>
        </Group>
      </div>

      <AnimatePresence>
        {dragging && (
          <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="glass pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl border-2 border-dashed border-query text-sm font-medium text-query">
            <span className="flex items-center gap-2">
              <FileUp className="size-4" />
              {s.drop}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
