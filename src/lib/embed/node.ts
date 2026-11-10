import type { EmbedModel, Embedder } from "@/lib/rag/types";
import { embedTexts, loadExtractor } from "./core";

/** The embedder in the current process, for the terminal scripts. The model is downloaded once and cached on disk. */
export async function nodeEmbedder(model: EmbedModel): Promise<Embedder> {
  const extractor = await loadExtractor(model);
  return { model, embed: (texts, kind, onProgress) => embedTexts(extractor, model, texts, kind, onProgress) };
}
