"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PipelineRail } from "@/components/pipeline/pipeline-rail";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { Mark } from "./logo";

/** The landing page: the name, one sentence, the pipeline as a figure, and the way in. */
export function Home() {
  const t = useT();
  const [head, tail] = BRAND.wordmark;
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="flex flex-col items-start gap-6 pt-16 pb-12 sm:pt-24">
        <h1 className="flex items-center gap-3 text-5xl font-semibold tracking-tight sm:text-6xl">
          <Mark />
          <span>
            {head}
            <span className="text-query">{tail}</span>
          </span>
        </h1>
        <p className="max-w-xl text-lg text-balance text-muted-foreground sm:text-xl">{t.home.sentence}</p>
        <Button asChild size="lg" className="px-4">
          <Link href="/lab">
            {t.home.open}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>

      <section className="pb-12" aria-label={t.lab.pipeline}>
        <PipelineRail />
      </section>

      <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {t.home.points.map((point, index) => (
          <div key={point.title} className="flex flex-col gap-2 bg-card p-5">
            <span className="num text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="font-medium">{point.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{point.body}</p>
          </div>
        ))}
      </section>

      <div className="h-16" />
    </main>
  );
}
