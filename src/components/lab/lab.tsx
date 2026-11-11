"use client";

import { useEffect } from "react";
import { PipelineRail } from "@/components/pipeline/pipeline-rail";
import { saveNow, startPlayback, useLab } from "@/lib/store/lab";
import { rememberLab } from "@/lib/store/last-lab";
import { AnswerPanel } from "./answer-panel";
import { AskBar } from "./ask-bar";
import { Sidebar } from "./sidebar";
import { Stage } from "./stage";

/**
 * One dataset, open: a fixed screen from `lg` up. The dataset in a sidebar
 * on the left; on the right the pipeline along the top, the stage and the
 * answer side by side, and the question with the transport along the
 * bottom. Nothing scrolls the page; each panel scrolls inside itself. On a
 * phone the same parts stack and the page scrolls.
 */
export function Lab({ id }: { id: string }) {
  useEffect(() => {
    void useLab.getState().open(id);
    rememberLab(`/lab/${id}`);
    // In development the store is on `window.lab`, to drive the lab from the console or a script.
    if (process.env.NODE_ENV !== "production") (window as unknown as { lab: typeof useLab }).lab = useLab;
    const stop = startPlayback();
    window.addEventListener("pagehide", saveNow);
    return () => {
      stop();
      window.removeEventListener("pagehide", saveNow);
      useLab.getState().close();
    };
  }, [id]);

  return (
    <main className="lab flex animate-[rise_0.5s_var(--ease)_backwards] flex-col lg:grid lg:h-[calc(100svh-var(--nav-h))] lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:overflow-hidden">
      <Sidebar className="max-lg:order-last max-lg:border-t" />
      <div className="flex min-h-0 min-w-0 flex-col">
        <PipelineRail className="shrink-0 border-b border-border bg-card" />
        <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Stage className="max-lg:h-[46rem]" />
          <AnswerPanel className="max-lg:border-t" />
        </div>
        <AskBar className="shrink-0 max-lg:sticky max-lg:bottom-0 max-lg:z-10" />
      </div>
    </main>
  );
}
