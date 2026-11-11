import { assemble } from "./assemble";
import { searchSparse } from "./bm25";
import { searchDense } from "./dense";
import { diversify } from "./mmr";
import { place } from "./project";
import { buildPrompt, type PromptLocale } from "./prompt";
import { fuse } from "./rrf";
import { cacheKey } from "./run-ingest";
import type { Settings } from "./settings";
import { timed } from "./timing";
import type { Embedded, Index, QueryTrace, Runtime } from "./types";

/**
 * A question in, the context out, and the trace of how it was chosen: from
 * the question's vector to the exact prompt. Everything here is code; the
 * model is called afterwards, with what this returns, or not at all when
 * the gate fails.
 */
export async function query(
  index: Index,
  question: string,
  settings: Settings,
  runtime: Runtime,
  options: { locale: PromptLocale; instructions?: string },
): Promise<QueryTrace> {
  const trace: QueryTrace = [];
  const { dims } = index.model;
  const { mode, k, k1, b, rrfK, lambda, threshold } = settings.retrieve;

  // The one stage here that is not a pure function: the model runs, unless this text was embedded before.
  const started = runtime.now();
  const key = cacheKey(runtime, question, "query");
  const known = runtime.cache.get(key);
  let embedded = known;
  if (!embedded) {
    [embedded] = await runtime.embedder.embed([question], "query");
    runtime.cache.set(key, embedded);
  }
  const vector = (embedded as Embedded).vector;
  trace.push({ kind: "query", text: question, tokens: (embedded as Embedded).tokens, vector, point: place(index.projection, vector), cached: Boolean(known), ms: runtime.now() - started });

  // Both searches always run, so their rankings can be compared on screen; the mode decides which ones count.
  const dense = timed(runtime, () => searchDense(index.vectors, dims, vector, k));
  trace.push({ kind: "dense", hits: dense.value.hits, scores: dense.value.scores, scanned: index.chunks.length, ms: dense.ms });

  const sparse = timed(runtime, () => searchSparse(index.sparse, question, k, k1, b));
  trace.push({ kind: "sparse", terms: sparse.value.terms, hits: sparse.value.hits, ms: sparse.ms });

  const fused = timed(runtime, () => fuse(dense.value.hits, sparse.value.hits, mode, rrfK));
  trace.push({ kind: "fuse", mode, k: rrfK, hits: fused.value, ms: fused.ms });

  const diverse = timed(runtime, () => diversify(fused.value, index.vectors, dims, lambda, settings.context.sources));
  const { kept, dropped } = diverse.value;
  trace.push({ kind: "diversify", lambda, kept, dropped, ms: diverse.ms });

  // The gate reads the best cosine over every chunk, whatever the mode.
  const gate = timed(runtime, () => {
    let best = 0;
    for (const score of dense.value.scores) if (score > best) best = score;
    return { best, pass: index.chunks.length > 0 && (threshold === null || best >= threshold) };
  });
  trace.push({ kind: "gate", best: gate.value.best, threshold, pass: gate.value.pass, ms: gate.ms });
  if (!gate.value.pass) return trace;

  const packed = timed(runtime, () => {
    const context = assemble(index, kept, settings.context.budget, settings.context.order);
    return { context, prompt: buildPrompt({ question, sources: context.sources, locale: options.locale, instructions: options.instructions }) };
  });
  const { context, prompt } = packed.value;
  trace.push({ kind: "assemble", sources: context.sources, tokens: context.tokens, budget: settings.context.budget, leftOut: context.leftOut, prompt, ms: packed.ms });
  return trace;
}
