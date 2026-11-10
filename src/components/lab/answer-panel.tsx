"use client";

import { Check, ChevronDown, RotateCw, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { FADE, SPRING } from "@/lib/motion";
import { stepOf, type Source } from "@/lib/rag/types";
import { useLab } from "@/lib/store/lab";
import { slotOf } from "@/lib/store/playhead";
import { useEntered, usePassed } from "@/lib/store/use-cursor";
import { cn } from "@/lib/utils";
import { Tag } from "./panel";

/** The answer's text, with each "[n]" as a chip that lights its source everywhere. */
function Cited({ text, sources, valid }: { text: string; sources: Source[]; valid: (n: number) => boolean }) {
  const hover = useLab((state) => state.hover);
  const parts = text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[(.+)\]$/.exec(part);
        if (!match || !/^\d/.test(match[1])) return <Fragment key={i}>{part}</Fragment>;
        return match[1].split(",").map((raw) => {
          const n = Number.parseInt(raw.trim(), 10);
          const source = sources.find((candidate) => candidate.n === n);
          return (
            <motion.span
              key={`${i}-${n}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              onPointerEnter={() => source && hover(source.chunks[0])}
              onPointerLeave={() => hover(null)}
              className={cn(
                "num mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded px-1 align-[0.1em] text-[0.6875rem] font-medium",
                valid(n) ? "bg-query text-query-foreground" : "bg-flag/20 text-flag line-through",
              )}
            >
              {n}
            </motion.span>
          );
        });
      })}
    </>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 animate-[breathe_1.2s_ease-in-out_infinite] rounded-full bg-current" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

/**
 * The last stages of the run: what the model wrote, what code found when
 * it read the answer back, the numbered sources it was given, and the
 * prompt exactly as sent. The text is held back until the replay reaches
 * the generation stage, then follows the stream.
 */
export function AnswerPanel({ className }: { className?: string }) {
  const { t, locale } = useLocale();
  const a = t.lab.answer;
  const answer = useLab((state) => state.answer);
  const trace = useLab((state) => state.queryTrace);
  const question = useLab((state) => state.question);
  const hovered = useLab((state) => state.hovered);
  const hover = useLab((state) => state.hover);
  const regenerate = useLab((state) => state.regenerate);
  const [promptOpen, setPromptOpen] = useState(false);

  const assembled = stepOf(trace, "assemble");
  const check = stepOf(trace, "verify");
  const generated = stepOf(trace, "generate");
  const packed = useEntered(slotOf("assemble")) && Boolean(assembled);
  const writing = useEntered(slotOf("generate"));
  const checked = usePassed(slotOf("generate")) && Boolean(check);
  const sources = assembled?.sources ?? [];
  const known = new Set(sources.map((source) => source.n));

  // An answer written for an earlier context stays on screen, dimmed, wherever the replay stands.
  const showText = answer.status === "stale" || (writing && (answer.status === "streaming" || answer.status === "done" || (answer.status === "error" && Boolean(answer.text))));
  const invalid = check?.citations.filter((citation) => !citation.valid).length ?? 0;

  return (
    <aside className={cn("flex min-h-0 flex-col border-border bg-card lg:border-l", className)}>
      <header className="flex h-10 shrink-0 items-center gap-2 px-4">
        <h2 className="eyebrow">{a.title}</h2>
        {answer.model && (showText || answer.status === "pending") && <Tag className="ml-auto normal-case">{answer.model.split("/").pop()}</Tag>}
      </header>

      <div className="fade-y scrollbar-none flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-2 pb-8">
        {question && (
          <p className="text-sm font-medium text-balance" lang="pt-BR">
            {question}
          </p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {!trace ? (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="text-sm leading-relaxed text-muted-foreground">
              {a.idle}
            </motion.p>
          ) : answer.status === "skipped" ? (
            <motion.p key="skipped" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="text-sm leading-relaxed text-muted-foreground">
              {a.skipped}
            </motion.p>
          ) : answer.status === "off" ? (
            <motion.div key="off" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="rounded-lg border border-dashed border-flag/50 p-3 text-sm">
              <p className="font-medium text-flag">{a.off}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.offBody}</p>
            </motion.div>
          ) : showText ? (
            <motion.div key="text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex flex-col gap-3">
              <p className={cn("text-[0.9375rem] leading-7 whitespace-pre-wrap transition-opacity duration-300", answer.status === "stale" && "opacity-45")} lang="pt-BR">
                <Cited text={answer.text} sources={sources} valid={(n) => known.has(n)} />
                {answer.status === "streaming" && <span className="ml-0.5 inline-block h-4 w-[2px] animate-[breathe_1s_ease-in-out_infinite] bg-query align-middle" />}
              </p>
              {answer.status === "stale" && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{a.stale}</span>
                  <button type="button" onClick={() => regenerate(locale)} className="press inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2 text-foreground hover:bg-accent">
                    <RotateCw className="size-3" />
                    {a.again}
                  </button>
                </div>
              )}
              {answer.status === "done" && answer.usage && (
                <p className="num text-[0.6875rem] text-muted-foreground">
                  {a.usage(answer.usage.inputTokens, answer.usage.outputTokens)}
                  {generated && ` · ${Math.round(generated.ms)} ms`}
                </p>
              )}
            </motion.div>
          ) : answer.status === "error" ? (
            <motion.p key="error" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex items-start gap-2 text-sm text-flag">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {a.errors[answer.error ?? "failed"]}
            </motion.p>
          ) : (
            <motion.p key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="flex items-center gap-2 text-sm text-muted-foreground">
              {writing ? a.pending : a.waiting}
              <Dots />
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {checked && check && answer.status === "done" && (
            <motion.section key="checks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex flex-col gap-2">
              <h3 className="eyebrow">{a.checks}</h3>
              <ul className="flex flex-col gap-1.5 text-xs">
                {check.citations.map((citation, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={cn("mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full", citation.valid ? "bg-query text-query-foreground" : "bg-flag text-background")}>
                      {citation.valid ? <Check className="size-2.5" strokeWidth={3} /> : <TriangleAlert className="size-2.5" />}
                    </span>
                    <span className="leading-relaxed text-muted-foreground">
                      <span className="num text-foreground">[{citation.n}]</span> {citation.valid ? a.valid : a.invalid}
                      {citation.valid && citation.support !== null && <>. {a.support(Math.round(citation.support * 100))}</>}
                    </span>
                  </li>
                ))}
                <li className={cn("leading-relaxed", check.uncited.length || invalid ? "text-flag" : "text-muted-foreground")}>{check.uncited.length ? a.uncited(check.uncited.length) : check.citations.length ? a.allCited : a.uncited(check.sentences.length)}</li>
              </ul>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {packed && sources.length > 0 && (
            <motion.section key="sources" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex flex-col gap-2">
              <h3 className="eyebrow">{a.sources}</h3>
              <ol className="flex flex-col gap-1.5" onPointerLeave={() => hover(null)}>
                {sources.map((source) => {
                  const lit = hovered !== null && source.chunks.includes(hovered);
                  return (
                    <li key={source.n} onPointerEnter={() => hover(source.chunks[0])} className={cn("rounded-lg border px-2.5 py-2 transition-colors duration-200", lit ? "border-query/60 bg-query/[0.07]" : "border-border")}>
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="num rounded bg-query px-1 font-medium text-query-foreground">{source.n}</span>
                        <span className="min-w-0 flex-1 truncate font-medium" lang="pt-BR">{source.title ?? ""}</span>
                        <span className="num text-[0.6875rem] text-muted-foreground">{source.tokens}</span>
                      </div>
                      <p className={cn("mt-1 text-xs leading-relaxed text-muted-foreground", !lit && "line-clamp-2")} lang="pt-BR">
                        {source.text.replace(/\s+/g, " ")}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </motion.section>
          )}
        </AnimatePresence>

        {packed && assembled && (
          <section className="flex flex-col">
            <button type="button" onClick={() => setPromptOpen((open) => !open)} aria-expanded={promptOpen} className="press flex items-center gap-1.5 text-left">
              <span className="eyebrow">{a.prompt}</span>
              <motion.span animate={{ rotate: promptOpen ? 180 : 0 }} transition={SPRING} className="text-muted-foreground">
                <ChevronDown className="size-3.5" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {promptOpen && (
                <motion.div key="prompt" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                  {(["system", "user"] as const).map((role) => (
                    <div key={role} className="mt-2">
                      <span className="num text-[0.625rem] tracking-wide text-muted-foreground uppercase">{a[role]}</span>
                      <pre className="num mt-1 rounded-lg bg-muted p-2.5 text-[0.6875rem] leading-relaxed whitespace-pre-wrap">{assembled.prompt[role]}</pre>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </aside>
  );
}
