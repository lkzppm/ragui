/**
 * The stages of the pipeline, in order, as data. The rail, the inspector
 * and (later) the replay all read this list, so a stage is added in one
 * place. Names and explanations are in `src/i18n/`, keyed by id.
 */
import type { Settings } from "./settings";
import type { StageId } from "./types";

export type StageGroup = "ingest" | "query";

/** A setting shown in a stage's inspector: its key in the dictionary and its current value. */
export interface Knob {
  key: KnobKey;
  value: string | number | null;
}

export type KnobKey =
  | "strategy"
  | "size"
  | "overlap"
  | "model"
  | "dtype"
  | "device"
  | "mode"
  | "k"
  | "k1"
  | "b"
  | "rrfK"
  | "lambda"
  | "threshold"
  | "sources"
  | "budget"
  | "order"
  | "llm"
  | "temperature"
  | "seed"
  | "maxOutputTokens";

export interface Stage {
  id: StageId;
  group: StageGroup;
  /** What the stage computes, written with the symbols of spec/02-rag-pipeline.md. */
  formula: string | null;
  /** The settings this stage reads. Changing one makes it and everything after it stale. */
  knobs: (settings: Settings) => Knob[];
}

const none = (): Knob[] => [];

export const STAGES: readonly Stage[] = [
  { id: "load", group: "ingest", formula: null, knobs: none },
  { id: "clean", group: "ingest", formula: null, knobs: none },
  {
    id: "chunk",
    group: "ingest",
    formula: "overlap(cᵢ) = cᵢ₋₁.end − cᵢ.start",
    knobs: (s) => [
      { key: "strategy", value: s.chunk.strategy },
      { key: "size", value: s.chunk.size },
      { key: "overlap", value: s.chunk.overlap },
    ],
  },
  {
    id: "embed",
    group: "ingest",
    formula: "v = mean(tokens) / ‖mean(tokens)‖        v ∈ ℝ³⁸⁴",
    knobs: (s) => [
      { key: "model", value: s.embed.model },
      { key: "dtype", value: s.embed.dtype },
      { key: "device", value: s.embed.device },
    ],
  },
  { id: "index", group: "ingest", formula: "(x, y) = ((v − μ) · p₁, (v − μ) · p₂)", knobs: none },
  { id: "query", group: "query", formula: 'q = embed("query: " + question)', knobs: none },
  {
    id: "dense",
    group: "query",
    formula: "sim(q, c) = Σᵢ qᵢ · cᵢ",
    knobs: (s) => [{ key: "k", value: s.retrieve.k }],
  },
  {
    id: "sparse",
    group: "query",
    formula: "bm25(q, c) = Σₜ idf(t) · f(t,c) · (k₁ + 1) / (f(t,c) + k₁ · (1 − b + b · |c| / avg))",
    knobs: (s) => [
      { key: "k", value: s.retrieve.k },
      { key: "k1", value: s.retrieve.k1 },
      { key: "b", value: s.retrieve.b },
    ],
  },
  {
    id: "fuse",
    group: "query",
    formula: "rrf(c) = Σ_L 1 / (k + rank_L(c))",
    knobs: (s) => [
      { key: "mode", value: s.retrieve.mode },
      { key: "rrfK", value: s.retrieve.rrfK },
    ],
  },
  {
    id: "diversify",
    group: "query",
    formula: "next = argmax_c  λ · sim(c, q) − (1 − λ) · max_s sim(c, s)",
    knobs: (s) => [{ key: "lambda", value: s.retrieve.lambda }],
  },
  {
    id: "gate",
    group: "query",
    formula: "pass = max_c sim(q, c) ≥ τ",
    knobs: (s) => [{ key: "threshold", value: s.retrieve.threshold }],
  },
  {
    id: "assemble",
    group: "query",
    formula: "Σ tokens(sourceᵢ) ≤ budget",
    knobs: (s) => [
      { key: "sources", value: s.context.sources },
      { key: "budget", value: s.context.budget },
      { key: "order", value: s.context.order },
    ],
  },
  {
    id: "generate",
    group: "query",
    formula: null,
    knobs: (s) => [
      { key: "llm", value: s.generate.model },
      { key: "temperature", value: s.generate.temperature },
      { key: "seed", value: s.generate.seed },
      { key: "maxOutputTokens", value: s.generate.maxOutputTokens },
    ],
  },
  { id: "verify", group: "query", formula: null, knobs: none },
];

/**
 * How the rail is drawn: one column per step in time. Dense and sparse
 * search run side by side on the same question, so they share a column.
 */
export const RAIL: Record<StageGroup, readonly (readonly StageId[])[]> = {
  ingest: [["load"], ["clean"], ["chunk"], ["embed"], ["index"]],
  query: [["query"], ["dense", "sparse"], ["fuse"], ["diversify"], ["gate"], ["assemble"], ["generate"], ["verify"]],
};

const BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

export function stageOf(id: StageId): Stage {
  const stage = BY_ID.get(id);
  if (!stage) throw new Error(`Unknown stage: ${id}`);
  return stage;
}

/** Whether the model takes part in a stage. Everything else is code. */
export function usesModel(id: StageId): boolean {
  return id === "generate";
}
