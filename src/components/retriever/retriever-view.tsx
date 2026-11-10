"use client";

import type { Index, QueryTrace } from "@/lib/rag/types";
import { ContextTray } from "./context-tray";
import { EmbeddingMap } from "./embedding-map";
import { Ranking } from "./ranking";

/** Why these passages: the space on the left, the three rankings on the right, and what reached the prompt along the bottom. */
export function RetrieverView({ index, trace }: { index: Index; trace: QueryTrace }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-px bg-border">
      <div className="grid min-h-0 flex-1 gap-px max-lg:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <EmbeddingMap index={index} trace={trace} />
        <Ranking index={index} trace={trace} />
      </div>
      <ContextTray index={index} trace={trace} />
    </div>
  );
}
