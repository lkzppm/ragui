import type { CSSProperties } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const CENTRE = 16;
/** The four passages around the question, in the mark's 32 by 32 box. */
const PASSAGES: readonly (readonly [number, number])[] = [
  [7, 8],
  [25, 6],
  [26, 24],
  [6, 25],
];
/** How far a passage comes toward the question once it is linked, as a share of its distance. */
const PULL = 0.14;

/**
 * The mark: a question among passages, with the ring of a search around it.
 * Under the pointer (its own, or that of a `mark-host` around it) the search
 * happens: the ring widens, a line goes from the question to each passage,
 * and the passages turn a little and come closer, taking the question's
 * colour. The motion is in `globals.css` (`.mark`).
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("mark size-[1.15em] shrink-0 overflow-visible", className)} aria-hidden>
      <g className="mark-orbit">
        {PASSAGES.map(([x, y], i) => (
          <g key={`${x}-${y}`} style={{ "--i": i, "--dx": `${(CENTRE - x) * PULL}px`, "--dy": `${(CENTRE - y) * PULL}px` } as CSSProperties}>
            <line className="mark-link" x1={CENTRE} y1={CENTRE} x2={x} y2={y} strokeWidth="1.4" strokeLinecap="round" style={{ "--reach": 1 - PULL } as CSSProperties} />
            <circle className="mark-node" cx={x} cy={y} r="2.2" />
          </g>
        ))}
      </g>
      <circle className="mark-ring" cx={CENTRE} cy={CENTRE} r="8" fill="none" strokeWidth="1.5" />
      <circle cx={CENTRE} cy={CENTRE} r="3.6" className="fill-query" />
    </svg>
  );
}

/** The wordmark: "RAG" plain and "ui" in the question's colour. */
export function Logo({ className, label }: { className?: string; label: string }) {
  const [head, tail] = BRAND.wordmark;
  return (
    <Link href="/" aria-label={label} className={cn("mark-host inline-flex items-center gap-2 font-semibold tracking-tight select-none", className)}>
      <Mark />
      <span>
        {head}
        <span className="text-query">{tail}</span>
      </span>
    </Link>
  );
}
