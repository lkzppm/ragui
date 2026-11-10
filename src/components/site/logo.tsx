import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The mark: a question among passages, with the ring of a search around it. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-[1.15em] shrink-0", className)} aria-hidden>
      <g className="fill-corpus">
        <circle cx="7" cy="8" r="2.2" />
        <circle cx="25" cy="6" r="2.2" />
        <circle cx="26" cy="24" r="2.2" />
        <circle cx="6" cy="25" r="2.2" />
      </g>
      <circle cx="16" cy="16" r="8" fill="none" strokeWidth="1.5" className="stroke-query opacity-50" />
      <circle cx="16" cy="16" r="3.6" className="fill-query" />
    </svg>
  );
}

/** The wordmark: "RAG" plain and "ui" in the question's colour. */
export function Logo({ className, label }: { className?: string; label: string }) {
  const [head, tail] = BRAND.wordmark;
  return (
    <Link href="/" aria-label={label} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight select-none", className)}>
      <Mark />
      <span>
        {head}
        <span className="text-query">{tail}</span>
      </span>
    </Link>
  );
}
