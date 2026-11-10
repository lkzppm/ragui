"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses, for assistive technology. */
  label: string;
  className?: string;
}

/** A row of choices; a thumb slides to the chosen one. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  // One thumb per control, so two on a page never trade places.
  const layoutId = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("relative flex w-fit items-center rounded-lg border border-border p-0.5 text-xs font-medium", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn("relative z-10 rounded-md px-2.5 py-1.5 transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-0 -z-10 rounded-md bg-secondary" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
