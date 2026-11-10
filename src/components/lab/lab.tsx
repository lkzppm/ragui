"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { PipelineRail } from "@/components/pipeline/pipeline-rail";
import { useT } from "@/i18n/LocaleProvider";
import type { StageId } from "@/lib/rag/types";
import { DEFAULT_PRESET } from "@/lib/sandbox/presets";
import { Panel, Tag } from "./panel";
import { StageInspector } from "./stage-inspector";

/**
 * The lab, as a skeleton: one sandbox (the bundled sample), the pipeline as
 * it is defined, and the inspector of the selected stage. Nothing runs yet;
 * the page says so. What is on screen is real all the same: the stages, the
 * formulas and the settings are the ones the pipeline code will use.
 */
export function Lab() {
  const t = useT();
  const sandbox = DEFAULT_PRESET;
  const [selected, setSelected] = useState<StageId>("dense");
  const preset = t.presets[sandbox.id];

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{t.lab.sandbox}</span>
          {sandbox.preset && <Tag>{t.lab.sample}</Tag>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{preset.name}</h1>
        <p className="max-w-2xl text-muted-foreground">{preset.description}</p>
      </header>

      <aside className="rounded-xl border border-dashed border-flag/50 px-4 py-3 text-sm">
        <strong className="font-medium text-flag">{t.lab.scaffold.title}.</strong> <span className="text-muted-foreground">{t.lab.scaffold.body}</span>
      </aside>

      <PipelineRail selected={selected} onSelect={setSelected} />

      <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <Panel title={t.lab.documents} aside={<span className="num text-xs text-muted-foreground">{sandbox.documents.length}</span>}>
          <ul className="divide-y divide-border">
            {sandbox.documents.map((document) => (
              <li key={document.name} className="flex items-center gap-2.5 px-4 py-3">
                <FileText className="size-4 shrink-0 text-corpus" />
                <span className="num min-w-0 flex-1 truncate text-xs" title={document.name}>
                  {document.name}
                </span>
                {document.url && (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={t.lab.openDocument(document.name)}
                    aria-label={t.lab.openDocument(document.name)}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <StageInspector id={selected} settings={sandbox.settings} />

        <Panel title={t.lab.tests} aside={<span className="num text-xs text-muted-foreground">{sandbox.golden.length}</span>}>
          <p className="border-b border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">{t.lab.testsHint}</p>
          <ol className="divide-y divide-border">
            {sandbox.golden.map((item, index) => (
              <li key={item.id} className="flex gap-3 px-4 py-3">
                <span className="num pt-0.5 text-xs text-muted-foreground">{index + 1}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm" lang="pt-BR">
                    {item.question}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.lab.expected}: <span className="num text-foreground" lang="pt-BR">{item.expect}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </main>
  );
}
