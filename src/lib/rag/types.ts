/**
 * The vocabulary of the pipeline. A run returns a trace: an ordered list of
 * steps, each one plain data with its real inputs, outputs and duration.
 * The interface draws `(trace, playhead)` and keeps no pipeline state, so
 * what moves on screen is always something that was computed.
 *
 * Nothing in `src/lib/rag/` may touch React, the DOM, IndexedDB, the
 * network, the clock or a random source: the embedder and the clock are
 * handed in (`Runtime`). Ids are content hashes; ties are broken by position.
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

export type DocType = "pdf" | "text" | "markdown";

/** A document as it was read, before cleaning. */
export interface RawDoc {
  name: string;
  type: DocType;
  text: string;
}

/** A document after cleaning. Offsets everywhere refer to `text`. */
export interface Doc {
  /** Hash of the clean text. */
  id: string;
  name: string;
  type: DocType;
  text: string;
  /** Characters before cleaning. */
  rawChars: number;
}

export interface Chunk {
  /** Hash of (docId, start, end). */
  id: string;
  docId: string;
  /** Its row in the index. */
  index: number;
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
  /** Tokens the model reads; the rest of a longer text is ignored. */
  maxTokens: number;
}

export interface Embedded {
  /** L2-normalised. */
  vector: Float32Array;
  tokens: number;
  truncated: boolean;
}

/** What turns text into vectors: a Web Worker in the browser, the same model in-process in Node. */
export interface Embedder {
  model: EmbedModel;
  embed(texts: string[], kind: "query" | "passage", onProgress?: (done: number, total: number) => void): Promise<Embedded[]>;
}

/** What the pure functions cannot have themselves. */
export interface Runtime {
  embedder: Embedder;
  /** Milliseconds, for the durations in the trace. */
  now: () => number;
  /** Vectors already computed, by model, precision and text. */
  cache: Map<string, Embedded>;
}

/** A chunk with a score in some list. `rank` starts at 1; `chunk` is its row in the index. */
export interface Hit {
  chunk: number;
  score: number;
  rank: number;
}

export interface SparseHit extends Hit {
  /** The question's terms found in the chunk, and what each added to the score. */
  matched: { term: string; tf: number; score: number }[];
}

export interface FusedHit extends Hit {
  /** Its rank in each list, or `null` when that list did not return it. */
  denseRank: number | null;
  sparseRank: number | null;
}

export interface DroppedHit extends Hit {
  /** The already picked chunk it was too close to. */
  tooCloseTo: number;
  similarity: number;
}

/** One term of the question in the keyword search. */
export interface TermStat {
  term: string;
  /** Chunks that contain it. */
  df: number;
  idf: number;
}

/** A numbered entry of the context: one chunk, or adjacent ones merged. */
export interface Source {
  n: number;
  docId: string;
  title: string | null;
  chunks: number[];
  start: number;
  end: number;
  text: string;
  tokens: number;
}

/** The 2D picture of the vectors: the mean and the two principal components. */
export interface Projection {
  mean: Float32Array;
  components: [Float32Array, Float32Array];
  /** One (x, y) pair per chunk, in index order. */
  points: Float32Array;
  /** Share of the variance each axis keeps, 0 to 1. */
  explained: [number, number];
}

export interface SparseIndex {
  /** Per chunk: term → occurrences. */
  tf: Map<string, number>[];
  /** Term → chunks that contain it. */
  df: Map<string, number>;
  /** Words per chunk. */
  lengths: number[];
  avgLength: number;
}

/** Everything a question is answered from. Built by `ingest`, read by `query`. */
export interface Index {
  docs: Doc[];
  chunks: Chunk[];
  model: EmbedModel;
  /** chunks × dims, row-major, rows L2-normalised. */
  vectors: Float32Array;
  sparse: SparseIndex;
  projection: Projection;
}

export interface Usage {
  inputTokens: number | null;
  outputTokens: number | null;
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

export interface AnswerSentence {
  text: string;
  start: number;
  end: number;
  citations: number[];
}

export interface PromptMessages {
  system: string;
  user: string;
}

export type Step =
  | { kind: "load"; docs: { id: string; name: string; chars: number }[]; ms: number }
  | { kind: "clean"; before: number; after: number; ms: number }
  | { kind: "chunk"; strategy: ChunkStrategy; size: number; overlap: number; count: number; perDoc: number[]; ms: number }
  | { kind: "embed"; model: EmbedModel; embedded: number; cached: number; tokens: number; truncated: number; ms: number }
  | { kind: "index"; chunks: number; dims: number; terms: number; ms: number }
  | { kind: "query"; text: string; tokens: number; vector: Float32Array; point: [number, number]; ms: number }
  | { kind: "dense"; hits: Hit[]; scores: Float32Array; scanned: number; ms: number }
  | { kind: "sparse"; terms: TermStat[]; hits: SparseHit[]; ms: number }
  | { kind: "fuse"; mode: RetrieveMode; k: number; hits: FusedHit[]; ms: number }
  | { kind: "diversify"; lambda: number; kept: Hit[]; dropped: DroppedHit[]; ms: number }
  | { kind: "gate"; best: number; threshold: number | null; pass: boolean; ms: number }
  | { kind: "assemble"; sources: Source[]; tokens: number; budget: number; leftOut: Hit[]; prompt: PromptMessages; ms: number }
  | { kind: "generate"; model: string; usage: Usage | null; finishReason: string | null; ms: number }
  | { kind: "verify"; sentences: AnswerSentence[]; citations: CitationCheck[]; uncited: number[]; ms: number };

export type StepOf<K extends Step["kind"]> = Extract<Step, { kind: K }>;

type IngestKind = "load" | "clean" | "chunk" | "embed" | "index";

/** Load to index: produced when the documents or the chunk settings change. */
export type IngestTrace = Extract<Step, { kind: IngestKind }>[];

/** Query to verify: produced on each question. */
export type QueryTrace = Exclude<Step, { kind: IngestKind }>[];

export function stepOf<K extends Step["kind"]>(trace: readonly Step[] | null | undefined, kind: K): StepOf<K> | null {
  return (trace?.find((step) => step.kind === kind) as StepOf<K> | undefined) ?? null;
}
