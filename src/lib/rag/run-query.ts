import { assemble } from "./assemble";
import { searchSparse } from "./bm25";
import { searchDense } from "./dense";
import { diversify } from "./mmr";
import { place } from "./project";
import { buildPrompt, type PromptLocale } from "./prompt";
import { fuse } from "./rrf";
import { cacheKey } from "./run-ingest";
import type { Settings } from "./settings";
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
  let mark = runtime.now();
  const lap = () => {
    const now = runtime.now();
    const ms = now - mark;
    mark = now;
    return ms;
  };
  const { dims } = index.model;
  const { mode, k, k1, b, rrfK, lambda, threshold } = settings.retrieve;

  const key = cacheKey(runtime, question, "query");
  let embedded = runtime.cache.get(key) as Embedded | undefined;
  if (!embedded) {
    [embedded] = await runtime.embedder.embed([question], "query");
    runtime.cache.set(key, embedded);
  }
  trace.push({ kind: "query", text: question, tokens: embedded.tokens, vector: embedded.vector, point: place(index.projection, embedded.vector), ms: lap() });

  // Both searches always run, so their rankings can be compared on screen; the mode decides which ones count.
  const dense = searchDense(index.vectors, dims, embedded.vector, k);
  trace.push({ kind: "dense", hits: dense.hits, scores: dense.scores, scanned: index.chunks.length, ms: lap() });

  const sparse = searchSparse(index.sparse, question, k, k1, b);
  trace.push({ kind: "sparse", terms: sparse.terms, hits: sparse.hits, ms: lap() });

  const fused = fuse(dense.hits, sparse.hits, mode, rrfK);
  trace.push({ kind: "fuse", mode, k: rrfK, hits: fused, ms: lap() });

  const { kept, dropped } = diversify(fused, index.vectors, dims, lambda, settings.context.sources);
  trace.push({ kind: "diversify", lambda, kept, dropped, ms: lap() });

  // The gate reads the best cosine over every chunk, whatever the mode.
  let best = 0;
  for (const score of dense.scores) if (score > best) best = score;
  const pass = index.chunks.length > 0 && (threshold === null || best >= threshold);
  trace.push({ kind: "gate", best, threshold, pass, ms: lap() });
  if (!pass) return trace;

  const context = assemble(index, kept, settings.context.budget, settings.context.order);
  const prompt = buildPrompt({ question, sources: context.sources, locale: options.locale, instructions: options.instructions });
  trace.push({ kind: "assemble", sources: context.sources, tokens: context.tokens, budget: settings.context.budget, leftOut: context.leftOut, prompt, ms: lap() });
  return trace;
}
