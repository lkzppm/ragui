// The embedding model, off the main thread: loading and running it never
// freezes the page. One model at a time; a new `load` replaces it.
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { EmbedModel } from "@/lib/rag/types";
import { embedTexts, loadExtractor } from "./core";

export type WorkerRequest =
  | { type: "load"; model: EmbedModel }
  | { type: "embed"; id: number; texts: string[]; kind: "query" | "passage" };

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "embed-progress"; id: number; done: number; total: number }
  | { type: "embedded"; id: number; vectors: Float32Array[]; tokens: number[]; truncated: boolean[] }
  | { type: "error"; id: number | null; message: string };

const scope = self as unknown as {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

let model: EmbedModel | null = null;
let extractor: Promise<FeatureExtractionPipeline> | null = null;

scope.onmessage = async (event) => {
  const request = event.data;
  try {
    if (request.type === "load") {
      model = request.model;
      // Several files download at once; the bar shows their sum.
      const files = new Map<string, { loaded: number; total: number }>();
      extractor = loadExtractor(
        request.model,
        (progress) => {
          files.set(progress.file, { loaded: progress.loaded, total: progress.total });
          let loaded = 0;
          let total = 0;
          for (const file of files.values()) {
            loaded += file.loaded;
            total += file.total;
          }
          scope.postMessage({ type: "progress", loaded, total });
        },
        request.model.device,
      );
      await extractor;
      scope.postMessage({ type: "ready" });
      return;
    }
    if (!model || !extractor) throw new Error("The model is not loaded");
    const items = await embedTexts(await extractor, model, request.texts, request.kind, (done, total) =>
      scope.postMessage({ type: "embed-progress", id: request.id, done, total }),
    );
    const vectors = items.map((item) => item.vector);
    scope.postMessage(
      { type: "embedded", id: request.id, vectors, tokens: items.map((item) => item.tokens), truncated: items.map((item) => item.truncated) },
      vectors.map((vector) => vector.buffer),
    );
  } catch (error) {
    scope.postMessage({ type: "error", id: request.type === "embed" ? request.id : null, message: error instanceof Error ? error.message : String(error) });
  }
};
