"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** A group of the sidebar: a header that is always there, and a body that opens under it. */
export function Group({
  icon: Icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="press flex h-11 w-full items-center gap-2.5 px-4 text-left text-sm font-medium hover:bg-accent">
        <Icon className={cn("size-4 transition-colors duration-300", open ? "text-query" : "text-muted-foreground")} />
        <span className="flex-1">{title}</span>
        {summary !== undefined && <span className="num text-xs text-muted-foreground">{summary}</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="text-muted-foreground">
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 px-4 pt-1 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** A labelled number on a track. The value follows the finger; the label says what it is and shows it. */
export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  accent = false,
}: {
  label: string;
  value: number;
  display?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accent?: boolean;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="num text-foreground">{display ?? value}</span>
      </span>
      <input
        type="range"
        className={cn("slider", accent && "is-query")}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/** A small square button with only an icon. */
export function IconButton({ label, onClick, disabled, className, children }: { label: string; onClick?: () => void; disabled?: boolean; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("press grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35", className)}
    >
      {children}
    </button>
  );
}
