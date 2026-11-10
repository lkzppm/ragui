import { cn } from "@/lib/utils";

/** A titled card: the unit the lab is laid out in. */
export function Panel({ title, aside, className, children }: { title: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="eyebrow">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** A small label for a kind or a state. */
export function Tag({ className, title, children }: { className?: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className={cn("num inline-flex h-5 items-center rounded-md border border-border px-1.5 text-[0.625rem] tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </span>
  );
}
