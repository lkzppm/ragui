"use client";

import { ArrowUp, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Segmented } from "@/components/site/segmented";
import { useLocale } from "@/i18n/LocaleProvider";
import { SPRING } from "@/lib/motion";
import { useLab } from "@/lib/store/lab";
import { cursor, SLOTS } from "@/lib/store/playhead";
import { cn } from "@/lib/utils";
import { IconButton } from "./controls";

const SPEEDS = ["0.5", "1", "2", "max"] as const;
type SpeedKey = (typeof SPEEDS)[number];
const SPEED_VALUE: Record<SpeedKey, number> = { "0.5": 0.5, "1": 1, "2": 2, max: Infinity };

/**
 * The bottom bar: the question on the left, the transport on the right.
 * The scrubber is the run from loading to the checked answer; dragging it
 * moves the cursor directly, and everything on screen follows.
 */
export function AskBar({ className }: { className?: string }) {
  const { t, locale } = useLocale();
  const a = t.lab.ask;
  const sandbox = useLab((state) => state.sandbox);
  const ready = useLab((state) => Boolean(state.index));
  const question = useLab((state) => state.question);
  const playing = useLab((state) => state.playing);
  const speed = useLab((state) => state.speed);
  const limit = useLab((state) => state.limit);
  const reached = useLab((state) => state.reached);
  const ask = useLab((state) => state.ask);
  const setPlaying = useLab((state) => state.setPlaying);
  const setSpeed = useLab((state) => state.setSpeed);
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
  const speedKey = (SPEEDS.find((key) => SPEED_VALUE[key] === speed) ?? "1") as SpeedKey;
  const suggestions = [...sandbox.golden.map((test) => test.question), ...sandbox.examples].filter((text) => text !== question);

  return (
    <div className={cn("flex flex-col gap-2 border-t border-border bg-card px-4 py-3 sm:px-5", className)}>
      <div className="scrollbar-none fade-x -mr-4 flex items-center gap-1.5 overflow-x-auto pr-8 sm:-mr-5">
        <span className="eyebrow shrink-0 pr-1">{a.examples}</span>
        <AnimatePresence initial={false} mode="popLayout">
          {suggestions.map((text) => (
            <motion.button
              key={text}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING}
              disabled={!ready}
              onClick={() => submit(text)}
              className="press h-7 shrink-0 rounded-full border border-border px-3 text-xs whitespace-nowrap text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
              lang="pt-BR"
            >
              {text}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

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
            placeholder={ready ? a.placeholder : a.notReady}
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

        <input
          ref={scrubber}
          type="range"
          aria-label={a.scrub}
          className="slider is-query w-32 flex-1 sm:max-w-56"
          min={0}
          max={SLOTS.length}
          step={0.001}
          defaultValue={0}
          style={{ "--fill": "0%" } as CSSProperties}
          onInput={(event) => seek(Number(event.currentTarget.value))}
        />

        <Segmented label={a.speed} value={speedKey} onChange={(key) => setSpeed(SPEED_VALUE[key])} options={SPEEDS.map((key) => ({ value: key, label: key === "max" ? "⚡" : `${key}×`, title: key === "max" ? a.instant : undefined }))} />
      </div>
    </div>
  );
}
