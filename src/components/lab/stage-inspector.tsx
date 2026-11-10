"use client";

import { AnimatePresence, motion } from "motion/react";
import { STAGE_ICONS } from "@/components/pipeline/stage-icons";
import { useT } from "@/i18n/LocaleProvider";
import type { Settings } from "@/lib/rag/settings";
import { STAGES, stageOf, usesModel } from "@/lib/rag/stages";
import type { StageId } from "@/lib/rag/types";
import { Panel, Tag } from "./panel";

/**
 * What the selected stage does, the expression it computes and the settings
 * it reads. Once the pipeline runs, the stage's own view (the chunked text,
 * the ranking, the map) takes the place of this description.
 */
export function StageInspector({ id, settings }: { id: StageId; settings: Settings }) {
  const t = useT();
  const stage = stageOf(id);
  const text = t.stages[id];
  const knobs = stage.knobs(settings);
  const by = usesModel(id) ? t.lab.by.model : t.lab.by.code;
  const Icon = STAGE_ICONS[id];
  const position = STAGES.findIndex((other) => other.id === id) + 1;

  return (
    <Panel title={t.lab.stage(position, STAGES.length)} aside={<Tag title={by.hint} className={usesModel(id) ? "border-query/40 text-query" : undefined}>{by.tag}</Tag>}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Icon className="size-5 text-muted-foreground" />
              {text.name}
            </h3>
            <p className="max-w-prose leading-relaxed text-muted-foreground">{text.what}</p>
          </div>

          {stage.formula && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow">{t.lab.formula}</span>
              <pre className="num overflow-x-auto rounded-lg bg-muted px-3.5 py-3 text-sm leading-relaxed">{stage.formula}</pre>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="eyebrow">{t.lab.knobs}</span>
            {knobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.lab.noKnobs}</p>
            ) : (
              <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                {knobs.map((knob) => (
                  <div key={knob.key} className="flex items-baseline justify-between gap-4 px-3.5 py-2">
                    <dt className="text-muted-foreground">{t.knobs[knob.key]}</dt>
                    <dd className="num text-right break-all">{knob.value ?? <span className="text-flag">{t.lab.notCalibrated}</span>}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}
