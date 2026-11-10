/**
 * Every knob of the pipeline, in one plain object. A sandbox owns one of
 * these; the pipeline functions take it as an argument and read nothing
 * else, so the same settings always give the same trace.
 */

export type ChunkStrategy = "fixed" | "recursive" | "structure";
export type EmbedModelId = "Xenova/multilingual-e5-small" | "Xenova/all-MiniLM-L6-v2";
export type EmbedDtype = "q8" | "fp32";
export type EmbedDevice = "wasm" | "webgpu";
export type RetrieveMode = "dense" | "sparse" | "hybrid";
export type ContextOrder = "rank" | "document";

export interface Settings {
  chunk: {
    strategy: ChunkStrategy;
    /** Target size of a chunk, in characters. */
    size: number;
    /** Characters shared with the previous chunk. */
    overlap: number;
  };
  embed: {
    model: EmbedModelId;
    dtype: EmbedDtype;
    device: EmbedDevice;
  };
  retrieve: {
    mode: RetrieveMode;
    /** Candidates kept by each search before fusion. */
    k: number;
    /** BM25 term-frequency saturation. */
    k1: number;
    /** BM25 length normalisation. */
    b: number;
    /** The constant of Reciprocal Rank Fusion. */
    rrfK: number;
    /** MMR: 1 is pure relevance, lower trades relevance for diversity. */
    lambda: number;
    /**
     * Minimum best similarity for the model to be called. It depends on the
     * embedding model and has to be measured; `null` means not calibrated,
     * and the gate lets everything through.
     */
    threshold: number | null;
  };
  context: {
    /** At most this many sources reach the prompt. */
    sources: number;
    /** Token budget of the sources together. */
    budget: number;
    order: ContextOrder;
  };
  generate: {
    /** The Groq model that writes the answer. The server may override it. */
    model: string;
    temperature: number;
    seed: number;
    maxOutputTokens: number;
  };
}

/**
 * Defaults sized for the assignment's contract: three pages, about 3,900
 * characters, which would fit in a prompt whole. The context is kept well
 * under that so retrieval has something to decide. All of them are starting
 * points to tune, not measured values (spec/02-rag-pipeline.md).
 */
export const DEFAULT_SETTINGS: Settings = {
  chunk: { strategy: "structure", size: 400, overlap: 60 },
  embed: { model: "Xenova/multilingual-e5-small", dtype: "q8", device: "wasm" },
  retrieve: { mode: "hybrid", k: 8, k1: 1.2, b: 0.75, rrfK: 60, lambda: 0.7, threshold: null },
  context: { sources: 4, budget: 500, order: "rank" },
  generate: { model: "openai/gpt-oss-120b", temperature: 0, seed: 7, maxOutputTokens: 400 },
};
