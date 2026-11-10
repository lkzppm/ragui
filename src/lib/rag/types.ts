/**
 * The vocabulary of the pipeline. A run returns a `Trace`: an ordered list
 * of steps, each one plain data with its real inputs, outputs and duration.
 * The interface draws `(trace, playhead)` and keeps no pipeline state, so
 * what moves on screen is always something that was computed.
 *
 * Nothing in `src/lib/rag/` may touch React, the DOM, IndexedDB, the
 * network, the clock or a random source. Ids are content hashes.
 */
import type { ChunkStrategy, EmbedDevice, EmbedDtype, EmbedModelId, RetrieveMode } from "./settings";

export type StageId =
  | "load"
  | "clean"
  | "chunk"
  | "embed"
  | "index"
  | "query"
  | "dense"
  | "sparse"
  | "fuse"
  | "diversify"
  | "gate"
  | "assemble"
  | "generate"
  | "verify";

/** A document after cleaning. Offsets everywhere refer to `text`. */
export interface Doc {
  /** Hash of the original bytes. */
  id: string;
  name: string;
  type: "pdf" | "text" | "markdown";
  text: string;
}

export interface Chunk {
  /** Hash of (docId, start, end). */
  id: string;
  docId: string;
  start: number;
  end: number;
  text: string;
  /** The heading of the section it was cut from, when the strategy keeps one. */
  title: string | null;
  /** Counted by the embedder's tokenizer; `null` until it has run. */
  tokens: number | null;
  /** True when the embedder ignored the end of the chunk (over its token limit). */
  truncated: boolean;
}

export interface EmbedModel {
  id: EmbedModelId;
  dtype: EmbedDtype;
  device: EmbedDevice;
  dims: number;
}

/** A chunk with a score in some list. `rank` starts at 1. */
export interface Hit {
  chunkId: string;
  score: number;
  rank: number;
}

export interface FusedHit extends Hit {
  /** Its rank in each list, or `null` when that list did not return it. */
  denseRank: number | null;
  sparseRank: number | null;
}

export interface DroppedHit extends Hit {
  /** The already picked chunk it was too close to. */
  tooCloseTo: string;
  similarity: number;
}

/** One term of the question in the sparse search. */
export interface TermStat {
  term: string;
  /** Chunks that contain it. */
  df: number;
  idf: number;
}

/** A numbered entry of the context: one chunk, or several adjacent ones merged. */
export interface Source {
  n: number;
  docId: string;
  title: string | null;
  chunkIds: string[];
  text: string;
  tokens: number;
}

/** The 2D picture of the vectors: the mean and the two principal components. */
export interface Projection {
  mean: Float32Array;
  components: [Float32Array, Float32Array];
  /** One (x, y) pair per chunk, in index order. */
  points: Float32Array;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CitationCheck {
  /** Index of the sentence in the answer. */
  sentence: number;
  /** The number cited, as written by the model. */
  n: number;
  /** False when no source with that number was sent. */
  valid: boolean;
  /** Share of the sentence's content words found in the cited source, 0 to 1. */
  support: number | null;
}

export type Step =
  | { kind: "load"; docId: string; name: string; chars: number; ms: number }
  | { kind: "clean"; docId: string; before: number; after: number; ms: number }
  | { kind: "chunk"; docId: string; strategy: ChunkStrategy; size: number; overlap: number; chunkIds: string[]; ms: number }
  | { kind: "embed"; model: EmbedModel; embedded: string[]; cached: string[]; ms: number }
  | { kind: "index"; chunks: number; dims: number; terms: number; projection: Projection; ms: number }
  | { kind: "query"; text: string; tokens: number; vector: Float32Array; ms: number }
  | { kind: "dense"; hits: Hit[]; scanned: number; ms: number }
  | { kind: "sparse"; terms: TermStat[]; hits: Hit[]; ms: number }
  | { kind: "fuse"; mode: RetrieveMode; k: number; hits: FusedHit[]; ms: number }
  | { kind: "diversify"; lambda: number; kept: Hit[]; dropped: DroppedHit[]; ms: number }
  | { kind: "gate"; best: number; threshold: number | null; pass: boolean }
  | { kind: "assemble"; sources: Source[]; tokens: number; budget: number; leftOut: Hit[] }
  | { kind: "generate"; model: string; usage: Usage | null; ms: number }
  | { kind: "verify"; citations: CitationCheck[]; uncited: number[] };

export type StepOf<K extends Step["kind"]> = Extract<Step, { kind: K }>;

/** Load to index: produced when the documents or the chunk settings change. */
export type IngestTrace = Extract<Step, { kind: "load" | "clean" | "chunk" | "embed" | "index" }>[];

/** Query to verify: produced on each question. */
export type QueryTrace = Exclude<Step, { kind: "load" | "clean" | "chunk" | "embed" | "index" }>[];

/**
 * Where a replay stands: the step being shown and how far into it, 0 to 1.
 * This is the only animation state there is.
 */
export interface Playhead {
  step: number;
  progress: number;
}
