import { buildSparseIndex } from "./bm25";
import { chunk, chunkInput } from "./chunk";
import { clean } from "./clean";
import { hash } from "./hash";
import { project } from "./project";
import type { Settings } from "./settings";
import type { Chunk, Doc, Embedded, Index, IngestTrace, RawDoc, Runtime, Step } from "./types";

export function cacheKey(runtime: Runtime, input: string, kind: "query" | "passage"): string {
  const { id, dtype, device } = runtime.embedder.model;
  return `${id}|${dtype}|${device}|${kind}|${hash(input)}`;
}

/**
 * Documents in, an index out, and the trace of how it was made. Each step
 * is reported as soon as it is done (`onStep`), so the interface can follow
 * a run that takes seconds; `onEmbed` reports chunks embedded so far.
 */
export async function ingest(
  raw: RawDoc[],
  settings: Settings,
  runtime: Runtime,
  on: { step?: (step: Step) => void; embed?: (done: number, total: number) => void } = {},
): Promise<{ index: Index; trace: IngestTrace }> {
  const trace: IngestTrace = [];
  const push = (step: IngestTrace[number]) => {
    trace.push(step);
    on.step?.(step);
  };
  let mark = runtime.now();
  const lap = () => {
    const now = runtime.now();
    const ms = now - mark;
    mark = now;
    return ms;
  };

  push({ kind: "load", docs: raw.map((doc) => ({ id: hash(doc.text), name: doc.name, chars: doc.text.length })), ms: lap() });

  const docs: Doc[] = raw.map((doc) => {
    const text = clean(doc.text);
    return { id: hash(text), name: doc.name, type: doc.type, text, rawChars: doc.text.length };
  });
  push({ kind: "clean", before: raw.reduce((sum, doc) => sum + doc.text.length, 0), after: docs.reduce((sum, doc) => sum + doc.text.length, 0), ms: lap() });

  const perDoc: number[] = [];
  const chunks: Chunk[] = [];
  for (const doc of docs) {
    const cut = chunk(doc, settings.chunk);
    perDoc.push(cut.length);
    for (const piece of cut) chunks.push({ ...piece, index: chunks.length });
  }
  push({ kind: "chunk", strategy: settings.chunk.strategy, size: settings.chunk.size, overlap: settings.chunk.overlap, count: chunks.length, perDoc, ms: lap() });

  // Only texts never embedded with this model are sent to it.
  const inputs = chunks.map(chunkInput);
  const keys = inputs.map((input) => cacheKey(runtime, input, "passage"));
  const missing = [...new Set(keys.filter((key) => !runtime.cache.has(key)))];
  if (missing.length) {
    const texts = missing.map((key) => inputs[keys.indexOf(key)]);
    const fresh = await runtime.embedder.embed(texts, "passage", on.embed);
    missing.forEach((key, i) => runtime.cache.set(key, fresh[i]));
  }
  const dims = runtime.embedder.model.dims;
  const vectors = new Float32Array(chunks.length * dims);
  let tokens = 0;
  let truncated = 0;
  chunks.forEach((piece, i) => {
    const embedded = runtime.cache.get(keys[i]) as Embedded;
    vectors.set(embedded.vector, i * dims);
    piece.tokens = embedded.tokens;
    piece.truncated = embedded.truncated;
    tokens += embedded.tokens;
    if (embedded.truncated) truncated++;
  });
  push({ kind: "embed", model: runtime.embedder.model, embedded: missing.length, cached: chunks.length - missing.length, tokens, truncated, ms: lap() });

  const sparse = buildSparseIndex(inputs);
  const projection = project(vectors, dims);
  push({ kind: "index", chunks: chunks.length, dims, terms: sparse.df.size, ms: lap() });

  return { index: { docs, chunks, model: runtime.embedder.model, vectors, sparse, projection }, trace };
}
