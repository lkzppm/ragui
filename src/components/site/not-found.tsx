"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LocaleProvider";

export function NotFound() {
  const t = useT();
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-24 sm:px-6">
      <span className="eyebrow">404</span>
      <h1 className="text-2xl font-semibold tracking-tight">{t.notFound.title}</h1>
      <p className="text-muted-foreground">{t.notFound.body}</p>
      <Button asChild className="mt-2">
        <Link href="/">{t.notFound.home}</Link>
      </Button>
    </main>
  );
}
