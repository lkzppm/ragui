"use client";

import { ArrowRight, ChevronDown, FileText, ListChecks, PackageCheck, Split, Zap } from "lucide-react";
import Link from "next/link";
import { siHuggingface, siNextdotjs, siTypescript, siWebgpu } from "simple-icons";
import { EmbeddingField } from "@/components/field/field-canvas";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { MODELS } from "@/lib/embed/models";
import { DEFAULT_SETTINGS } from "@/lib/rag/settings";
import { STAGES, usesModel } from "@/lib/rag/stages";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icon";
import { Footer } from "./footer";
import { HomeFigure } from "./home-figure";
import { Mark } from "./logo";
import { Reveal } from "./reveal";

const STACK = [
  { icon: siNextdotjs, label: "Next.js", href: "https://nextjs.org" },
  { icon: siTypescript, label: "TypeScript", href: "https://www.typescriptlang.org" },
  { icon: siHuggingface, label: "Transformers.js", href: "https://huggingface.co/docs/transformers.js" },
  { icon: siWebgpu, label: "WebGPU · vgpu", href: "https://vgpu.sh" },
  { icon: null, label: "Groq", href: "https://groq.com" },
];

const PRINCIPLE_ICONS = [FileText, Split, PackageCheck, ListChecks];

const BUTTON = "press inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium";

/**
 * The landing page, three screens, each on its own ground: the name over a
 * live toy of what the app does; how it works, beside real runs of it; and
 * what makes it worth opening, with the way in. Every number here is read
 * from the pipeline's own definitions.
 */
export function Home() {
  const t = useT();
  const [head, tail] = BRAND.wordmark;
  const code = STAGES.filter((stage) => !usesModel(stage.id)).length;
  const facts = [
    { value: STAGES.length, label: t.how.facts.stages },
    { value: code, label: t.how.facts.code },
    { value: MODELS[DEFAULT_SETTINGS.embed.model].dims, label: t.how.facts.dims },
    { value: 0, label: t.how.facts.servers },
  ];

  return (
    <>
      <main>
        {/* One viewport: the toy space behind, the name and the brief over it. */}
        <section className="relative flex min-h-[calc(100svh-var(--nav-h))] flex-col overflow-hidden border-b border-border">
          <EmbeddingField />
          {/* A veil behind the words, so no point or line cuts a letter: wide on a phone, the left half on a desk. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--background)_90%,transparent)_0%,color-mix(in_srgb,var(--background)_60%,transparent)_70%,transparent_100%)] sm:bg-[linear-gradient(to_right,color-mix(in_srgb,var(--background)_82%,transparent)_0%,color-mix(in_srgb,var(--background)_40%,transparent)_42%,transparent_58%)]"
          />
          <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-16 sm:px-6">
            <div className="max-w-xl">
              <p className="eyebrow animate-[rise_0.7s_var(--ease)_0.05s_backwards]">{t.hero.eyebrow}</p>
              <h1 className="display mt-5 flex animate-[rise_0.8s_var(--ease)_0.12s_backwards] items-center gap-4 text-7xl font-semibold sm:text-8xl">
                <Mark className="size-[0.72em]" />
                <span>
                  {head}
                  <span className="text-query">{tail}</span>
                </span>
              </h1>
              <p className="mt-6 animate-[rise_0.8s_var(--ease)_0.2s_backwards] text-xl leading-snug tracking-tight text-balance text-muted-foreground [text-shadow:0_0_18px_var(--background)] sm:text-2xl">
                {t.hero.sentence}
              </p>
              <div className="mt-9 flex animate-[rise_0.8s_var(--ease)_0.28s_backwards] flex-wrap gap-3">
                <Link href="/lab" className={cn(BUTTON, "group bg-foreground text-background hover:opacity-90")}>
                  {t.hero.open}
                  <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease)] group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a href={BRAND.repo} target="_blank" rel="noreferrer noopener" className={cn(BUTTON, "glass border border-border hover:border-foreground/30")}>
                  {t.common.source}
                </a>
              </div>
              <ul className="mt-10 flex animate-[rise_0.8s_var(--ease)_0.36s_backwards] flex-wrap gap-2">
                {STACK.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="glass press flex h-8 items-center gap-2 rounded-full border border-border px-3 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    >
                      {item.icon ? <BrandIcon icon={item.icon} className="size-3.5" /> : <Zap className="size-3.5" />}
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-7xl items-end justify-between gap-6 px-4 pb-6 sm:px-6">
            <a href="#how" className="group flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              {t.hero.discover}
              <ChevronDown className="size-4 animate-[nudge_1.8s_var(--ease)_infinite]" aria-hidden />
            </a>
            <p className="hidden max-w-[17rem] text-right text-xs leading-relaxed text-muted-foreground [text-shadow:0_0_12px_var(--background)] md:block">{t.hero.field}</p>
          </div>
        </section>

        {/* How it works, on a plain tint: the words and the facts on the left, real runs on the right. */}
        <section id="how" className="relative flex min-h-[calc(100svh-var(--nav-h))] scroll-mt-14 items-center border-b border-border bg-[var(--tint)]">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <Reveal as="h2" className="display text-4xl font-semibold text-balance sm:text-5xl">
                {t.how.title}
                <span className="text-query">.</span>
              </Reveal>
              <Reveal as="p" className="mt-5 text-lg leading-relaxed text-muted-foreground" delay={0.1}>
                {t.how.lead}
              </Reveal>
              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-border pt-7">
                {facts.map((fact, i) => (
                  <Reveal key={fact.label} delay={0.15 + i * 0.07}>
                    <dt className="num text-4xl tracking-tight">{fact.value}</dt>
                    <dd className="mt-2 text-sm leading-snug text-muted-foreground">{fact.label}</dd>
                  </Reveal>
                ))}
              </dl>
            </div>
            <Reveal delay={0.2}>
              <HomeFigure />
            </Reveal>
          </div>
        </section>

        {/* What it is for, and the way in. */}
        <section className="relative flex min-h-[calc(100svh-var(--nav-h))] items-center overflow-hidden">
          {/* A page of cells, like a vector laid flat, fading toward the edges. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_72%)]"
          />
          <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="eyebrow">{t.principles.eyebrow}</p>
              <h2 className="display mt-5 text-[clamp(2.25rem,5.4vw,4rem)] font-semibold text-balance">{t.principles.headline}</h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{t.principles.body}</p>
            </Reveal>
            <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.principles.items.map((item, i) => {
                const Icon = PRINCIPLE_ICONS[i];
                return (
                  <Reveal
                    key={item.title}
                    as="li"
                    delay={0.1 + i * 0.08}
                    className="group rounded-2xl border border-border bg-card p-5 transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease)] hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[var(--shadow-float)]"
                  >
                    <Icon className="size-5 text-muted-foreground transition-colors duration-300 group-hover:text-query" aria-hidden />
                    <h3 className="mt-4 font-medium tracking-tight">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </Reveal>
                );
              })}
            </ol>
            <Reveal delay={0.3} className="mt-14 flex justify-center">
              <Link href="/lab" className={cn(BUTTON, "group bg-query text-query-foreground hover:opacity-90")}>
                {t.principles.cta}
                <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease)] group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
