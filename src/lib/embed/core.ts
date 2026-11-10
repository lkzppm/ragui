/**
 * The embedder itself, shared by the Web Worker (browser) and the terminal
 * scripts (Node). It imports Transformers.js lazily, so nothing here is
 * pulled into a bundle that does not embed.
 */
import type { FeatureExtractionPipeline, ProgressInfo } from "@huggingface/transformers";
import type { EmbedModel, Embedded } from "@/lib/rag/types";
import { MODELS } from "./models";

export type LoadProgress = { file: string; loaded: number; total: number };

export async function loadExtractor(model: EmbedModel, onProgress?: (progress: LoadProgress) => void, device?: "wasm" | "webgpu"): Promise<FeatureExtractionPipeline> {
  const { pipeline } = await import("@huggingface/transformers");
  // The union of every task's pipeline is too large for the compiler to represent; this call only ever makes one.
  const create = pipeline as unknown as (task: "feature-extraction", model: string, options: Record<string, unknown>) => Promise<FeatureExtractionPipeline>;
  return create("feature-extraction", model.id, {
    dtype: model.dtype,
    ...(device ? { device } : {}),
    progress_callback: (info: ProgressInfo) => {
      if (info.status === "progress" && onProgress) onProgress({ file: info.file, loaded: info.loaded, total: info.total });
    },
  });
}

const BATCH = 4;

/** Mean-pooled, L2-normalised vectors, with the token count of each text as the model sees it. */
export async function embedTexts(
  extractor: FeatureExtractionPipeline,
  model: EmbedModel,
  texts: string[],
  kind: "query" | "passage",
  onProgress?: (done: number, total: number) => void,
): Promise<Embedded[]> {
  const prefix = MODELS[model.id].prefix[kind];
  const out: Embedded[] = [];
  for (let start = 0; start < texts.length; start += BATCH) {
    const batch = texts.slice(start, start + BATCH).map((text) => prefix + text);
    const tensor = await extractor(batch, { pooling: "mean", normalize: true });
    const data = tensor.data as Float32Array;
    batch.forEach((text, i) => {
      const tokens = extractor.tokenizer(text).input_ids.dims[1] as number;
      out.push({
        vector: data.slice(i * model.dims, (i + 1) * model.dims),
        tokens: Math.min(tokens, model.maxTokens),
        truncated: tokens > model.maxTokens,
      });
    });
    onProgress?.(Math.min(texts.length, start + BATCH), texts.length);
  }
  return out;
}
