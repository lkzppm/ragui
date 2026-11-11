"use client";

import { ArrowUp, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { SPRING } from "@/lib/motion";
import { useLab } from "@/lib/store/lab";
import { cursor, INGEST_SLOTS, SLOTS } from "@/lib/store/playhead";
import { cn } from "@/lib/utils";
import { IconButton } from "./controls";

/** Where indexing ends and the question begins, as a share of the scrubber. */
const SPLIT = INGEST_SLOTS / SLOTS.length;
/** The width of the scrubber's thumb: its centre travels the track less half of this at each end. */
const THUMB = 14;

/**
 * The bottom bar: the question on the left, the transport on the right.
 * The scrubber is the run from loading to the checked answer, in the same
 * two parts as the rail above: indexing, then the question. Dragging it
 * moves the cursor directly, and everything on screen follows. It goes no
 * further than what has been computed, so with no question asked it stops
 * at the mark between the two parts.
 */
export function AskBar({ className }: { className?: string }) {
  const { t, locale } = useLocale();
  const a = t.lab.ask;
  const empty = useLab((state) => state.phase === "empty");
  const ready = useLab((state) => Boolean(state.index));
  const asked = useLab((state) => Boolean(state.queryTrace));
  const playing = useLab((state) => state.playing);
  const limit = useLab((state) => state.limit);
  const reached = useLab((state) => state.reached);
  const ask = useLab((state) => state.ask);
  const setPlaying = useLab((state) => state.setPlaying);
  const seek = useLab((state) => state.seek);
  const step = useLab((state) => state.step);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const scrubber = useRef<HTMLInputElement>(null);

  // The scrubber follows the cursor without React rendering each frame.
  const paint = (position: number) => {
    const element = scrubber.current;
    if (!element) return;
    element.value = String(position);
    element.style.setProperty("--fill", `${(position / SLOTS.length) * 100}%`);
  };
  useMotionValueEvent(cursor, "change", paint);
  useEffect(() => paint(cursor.get()), []);

  // Space plays and pauses; the arrows step. Not while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying(!useLab.getState().playing);
      } else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "/") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPlaying, step]);

  const submit = (text: string) => {
    if (!ready || !text.trim()) return;
    setDraft("");
    void ask(text, locale);
  };
  const atEnd = reached >= Math.floor(limit) && cursor.get() >= limit - 0.001;
  const moving = playing && !atEnd;

  return (
    <div className={cn("border-t border-border bg-card px-4 py-3 sm:px-5", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form
          className="group relative flex min-w-[16rem] flex-1 items-center"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <input
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={ready ? a.placeholder : empty ? a.empty : a.notReady}
            disabled={!ready}
            maxLength={600}
            // 16px keeps iOS Safari from zooming into the field.
            className="h-11 w-full rounded-full border border-input bg-background pr-12 pl-4 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-query focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--query)_18%,transparent)] disabled:opacity-60 sm:text-sm"
          />
          <button
            type="submit"
            disabled={!ready || !draft.trim()}
            aria-label={a.send}
            title={a.send}
            className="press absolute right-1.5 grid size-8 place-items-center rounded-full bg-query text-query-foreground disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </form>

        <div className="flex items-center gap-1">
          <IconButton label={a.back} onClick={() => step(-1)}>
            <SkipBack className="size-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => setPlaying(!moving)}
            aria-label={moving ? a.pause : atEnd ? a.replay : a.play}
            title={moving ? a.pause : atEnd ? a.replay : a.play}
            className="press relative grid size-9 place-items-center overflow-hidden rounded-full bg-foreground text-background"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={moving ? "pause" : atEnd ? "replay" : "play"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={SPRING}>
                {moving ? <Pause className="size-4" fill="currentColor" /> : atEnd ? <RotateCcw className="size-4" /> : <Play className="size-4 translate-x-px" fill="currentColor" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <IconButton label={a.forward} onClick={() => step(1)}>
            <SkipForward className="size-4" />
          </IconButton>
        </div>

        <div className="flex w-44 flex-1 flex-col sm:max-w-72">
          <div className="pointer-events-none flex h-3.5 items-start text-[0.5625rem] leading-none" style={{ paddingInline: THUMB / 2 }} aria-hidden>
            <span className="eyebrow truncate text-[length:inherit]" style={{ width: `${SPLIT * 100}%` }}>
              {t.lab.groups.ingest.name}
            </span>
            <span className={cn("eyebrow min-w-0 flex-1 truncate pl-1.5 text-[length:inherit] transition-opacity duration-300", !asked && "opacity-40")}>{t.lab.groups.query.name}</span>
          </div>
          <div className="relative flex">
            <input
              ref={scrubber}
              type="range"
              aria-label={a.scrub}
              className="slider is-query"
              min={0}
              max={SLOTS.length}
              step={0.001}
              defaultValue={0}
              style={{ "--fill": "0%" } as CSSProperties}
              onInput={(event) => {
                seek(Number(event.currentTarget.value));
                // The cursor stops at what has been computed; the thumb is put back where the cursor really is.
                paint(cursor.get());
              }}
            />
            {/* With no question asked there is nothing to scrub in the second part: it is drawn fainter. */}
            <span
              className={cn("pointer-events-none absolute inset-y-0 right-0 bg-card transition-opacity duration-300", asked ? "opacity-0" : "opacity-65")}
              style={{ left: `calc(${THUMB + 1}px + (100% - ${THUMB}px) * ${SPLIT})` }}
              aria-hidden
            />
            {/* The mark between indexing and the question. */}
            <span className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-foreground/45" style={{ left: `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${SPLIT})` }} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
