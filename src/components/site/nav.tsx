"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siGithub } from "simple-icons";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icon";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";
import { ThemeSwitch } from "./theme-switch";

/** The top bar: the wordmark as the home link, the lab, the source, the language and the theme. */
export function Nav() {
  const t = useT();
  const pathname = usePathname();
  const inLab = pathname === "/lab" || pathname.startsWith("/lab/");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 sm:bg-background/80 sm:backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Logo label={t.common.home} className="text-lg" />

        <nav className="ml-2 flex items-center sm:ml-4" aria-label={t.common.pages}>
          <Link
            href="/lab"
            aria-current={inLab ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-accent hover:text-foreground",
              inLab ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
          >
            <FlaskConical className="size-4" />
            {t.nav.lab}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <a
            href={BRAND.repo}
            target="_blank"
            rel="noreferrer noopener"
            title={t.common.source}
            aria-label={t.common.source}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BrandIcon icon={siGithub} />
          </a>
          <LocaleSwitch />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
