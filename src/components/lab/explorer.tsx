"use client";

import { ArrowRight, FileText, FolderOpen, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { forgetSandbox } from "@/lib/store/lab";
import { rememberLab } from "@/lib/store/last-lab";
import { FADE, SPRING, SPRING_SLOW } from "@/lib/motion";
import { PRESETS } from "@/lib/sandbox/presets";
import { createSandbox, deleteSandbox, listSandboxes } from "@/lib/sandbox/storage";
import type { StoredSandbox } from "@/lib/sandbox/types";
import { cn } from "@/lib/utils";
import { ExplorerBackdrop } from "./explorer-backdrop";
import { Tag } from "./panel";

const CARD = "group relative flex h-full min-h-44 flex-col rounded-2xl border border-border bg-card p-5 text-left";

/**
 * Where the lab starts: the datasets. One card to make a new one, the
 * example that ships with the app, and the ones made in this browser.
 * Opening a card is the lab on that dataset.
 */
export function Explorer() {
  const t = useT();
  const e = t.lab.explorer;
  const router = useRouter();
  const [stored, setStored] = useState<StoredSandbox[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    // The Lab tab leads here again, not to the dataset that was open before.
    rememberLab("/lab");
    let alive = true;
    listSandboxes()
      .then((all) => alive && setStored(all))
      .catch(() => alive && setStored([]));
    return () => {
      alive = false;
    };
  }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const record = await createSandbox(name.trim() || e.untitled);
      router.push(`/lab/${record.id}`);
    } catch {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setConfirming(null);
    setStored((all) => all?.filter((record) => record.id !== id) ?? null);
    forgetSandbox(id);
    await deleteSandbox(id).catch(() => undefined);
  };

  const mine = stored?.filter((record) => !record.preset) ?? [];
  const date = (at: number) => new Date(at).toLocaleDateString(t.lang, { day: "numeric", month: "short" });

  return (
    <div className="relative isolate min-h-[calc(100svh-var(--nav-h))] overflow-hidden">
      {/* Fading towards the foot of the page, so the cards stand on quiet ground. */}
      <ExplorerBackdrop className="absolute inset-0 -z-10 size-full [mask-image:linear-gradient(to_bottom,black_30%,transparent_95%)]" />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-2xl">
        <p className="eyebrow animate-[rise_0.6s_var(--ease)_backwards]">{e.eyebrow}</p>
        <h1 className="display mt-3 animate-[rise_0.7s_var(--ease)_0.05s_backwards] text-4xl font-semibold sm:text-5xl">{e.title}</h1>
        <p className="mt-4 animate-[rise_0.7s_var(--ease)_0.1s_backwards] text-lg leading-snug tracking-tight text-balance text-muted-foreground">{e.lead}</p>
      </header>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card order={0}>
          <div className={cn(CARD, "border-dashed", creating ? "border-query" : "hover:border-foreground/30")}>
            <AnimatePresence mode="wait" initial={false}>
              {creating ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={FADE}
                  className="flex flex-1 flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void create();
                  }}
                >
                  <label className="flex flex-col gap-2">
                    <span className="eyebrow">{e.name}</span>
                    <input
                      autoFocus
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => event.key === "Escape" && setCreating(false)}
                      placeholder={e.namePlaceholder}
                      maxLength={60}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-query focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--query)_18%,transparent)] sm:text-sm"
                    />
                  </label>
                  <div className="mt-auto flex items-center gap-2">
                    <button type="submit" disabled={busy} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-query px-4 text-sm font-medium text-query-foreground disabled:opacity-60">
                      {e.createAction}
                      <ArrowRight className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => setCreating(false)} className="press inline-flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                      {e.cancel}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button key="new" type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={FADE} onClick={() => setCreating(true)} className="press -m-5 flex flex-1 flex-col rounded-2xl p-5 text-left">
                  <span className="grid size-10 place-items-center rounded-xl bg-query/12 text-query transition-transform duration-300 ease-[var(--ease)] group-hover:scale-110">
                    <Plus className="size-5" />
                  </span>
                  <span className="mt-auto pt-6 text-lg leading-tight font-semibold tracking-tight">{e.create}</span>
                  <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.createHint}</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </Card>

        {PRESETS.map((preset, i) => {
          const text = t.presets[preset.id];
          const asked = stored?.find((record) => record.id === preset.id)?.history.length ?? 0;
          return (
            <Card key={preset.id} order={i + 1}>
              <Link href={`/lab/${preset.id}`} className={cn(CARD, "press hover:border-foreground/30")}>
                <span className="flex items-center gap-2.5">
                  <span className="grid size-10 place-items-center rounded-xl bg-corpus/12 text-corpus">
                    <FileText className="size-5" />
                  </span>
                  <Tag className="ml-auto">{e.example}</Tag>
                </span>
                <span className="mt-auto pt-6 text-lg leading-tight font-semibold tracking-tight">{text.name}</span>
                <span className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{text.description}</span>
                <Meta>
                  {[e.documents(preset.documents.length), e.tests(preset.golden.length), asked ? e.asked(asked) : null].filter(Boolean).join(" · ")}
                </Meta>
              </Link>
            </Card>
          );
        })}

        <AnimatePresence initial={false}>
          {mine.map((record, i) => (
            <Card key={record.id} order={PRESETS.length + 1 + i} leaving>
              <div className={cn(CARD, "press hover:border-foreground/30")}>
                <span className="flex items-center gap-2.5">
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground/80">
                    <FolderOpen className="size-5" />
                  </span>
                  <span className="num ml-auto text-xs text-muted-foreground">{date(record.updatedAt)}</span>
                </span>
                {/* The whole card opens the dataset; the delete control sits above this link. */}
                <Link href={`/lab/${record.id}`} className="mt-auto pt-6 text-lg leading-tight font-semibold tracking-tight after:absolute after:inset-0 after:rounded-2xl">
                  <span className="line-clamp-2 break-words">{record.name || e.untitled}</span>
                </Link>
                <Meta>
                  <span className="min-w-0 flex-1 truncate">{[e.documents(record.docs.length), record.history.length ? e.asked(record.history.length) : null].filter(Boolean).join(" · ")}</span>
                  <span className="relative z-10 -my-2 -mr-2 flex items-center">
                    <AnimatePresence mode="wait" initial={false}>
                      {confirming === record.id ? (
                        <motion.button
                          key="confirm"
                          type="button"
                          autoFocus
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={SPRING}
                          onClick={() => void remove(record.id)}
                          onBlur={() => setConfirming(null)}
                          className="press inline-flex h-8 items-center gap-1.5 rounded-lg bg-flag/12 px-2.5 text-xs font-medium text-flag"
                        >
                          <Trash2 className="size-3.5" />
                          {e.confirm}
                        </motion.button>
                      ) : (
                        <motion.button
                          key="ask"
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={SPRING}
                          title={e.remove(record.name || e.untitled)}
                          aria-label={e.remove(record.name || e.untitled)}
                          onClick={() => setConfirming(record.id)}
                          className="press grid size-8 place-items-center rounded-lg text-muted-foreground opacity-60 hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </span>
                </Meta>
              </div>
            </Card>
          ))}
        </AnimatePresence>
      </ul>

      <p className="mt-8 animate-[rise_0.7s_var(--ease)_0.3s_backwards] text-xs leading-relaxed text-muted-foreground">{e.local}</p>
      </main>
    </div>
  );
}

/** One place in the grid. Cards arrive one after another; one that is deleted shrinks away and the rest close the gap. */
function Card({ order, leaving = false, children }: { order: number; leaving?: boolean; children: ReactNode }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={leaving ? { opacity: 0, scale: 0.92 } : undefined}
      transition={{ ...SPRING_SLOW, delay: Math.min(order, 8) * 0.05, layout: SPRING }}
      className="list-none"
    >
      {children}
    </motion.li>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <span className="num mt-4 flex min-h-5 items-center gap-2 border-t border-border pt-3.5 text-xs text-muted-foreground">{children}</span>;
}
