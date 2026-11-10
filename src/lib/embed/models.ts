import type { EmbedDevice, EmbedDtype, EmbedModelId } from "@/lib/rag/settings";
import type { EmbedModel } from "@/lib/rag/types";

interface ModelInfo {
  dims: number;
  maxTokens: number;
  /** Megabytes downloaded on the first visit, by precision. */
  size: Record<EmbedDtype, number>;
  /** E5 models are trained with a prefix on every input; without it a question lands somewhere else. */
  prefix: { query: string; passage: string };
  multilingual: boolean;
}

export const MODELS: Record<EmbedModelId, ModelInfo> = {
  "Xenova/multilingual-e5-small": { dims: 384, maxTokens: 512, size: { q8: 118, fp32: 470 }, prefix: { query: "query: ", passage: "passage: " }, multilingual: true },
  "Xenova/all-MiniLM-L6-v2": { dims: 384, maxTokens: 256, size: { q8: 23, fp32: 90 }, prefix: { query: "", passage: "" }, multilingual: false },
};

export function modelOf(settings: { model: EmbedModelId; dtype: EmbedDtype; device: EmbedDevice }): EmbedModel {
  const info = MODELS[settings.model];
  return { id: settings.model, dtype: settings.dtype, device: settings.device, dims: info.dims, maxTokens: info.maxTokens };
}
