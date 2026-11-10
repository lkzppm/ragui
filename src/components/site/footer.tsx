"use client";

import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";

/** One line: what this is for, who made it, where the source is. */
export function Footer() {
  const t = useT();
  const { name, school, term } = BRAND.course;
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 text-xs text-muted-foreground sm:px-6">
        <span>
          {BRAND.name} · {t.footer.course(name, school, term)}
        </span>
        <span>
          {t.footer.by}{" "}
          <a href={BRAND.author.github} target="_blank" rel="noreferrer noopener" className="text-foreground underline-offset-4 hover:underline">
            {BRAND.author.name}
          </a>
          {" · "}
          <a href={BRAND.repo} target="_blank" rel="noreferrer noopener" className="underline-offset-4 hover:text-foreground hover:underline">
            {t.common.source}
          </a>
        </span>
      </div>
    </footer>
  );
}
