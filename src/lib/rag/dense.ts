import { dot, ranking, row } from "./similarity";
import type { Hit } from "./types";

/**
 * Exact search: the question's vector against every chunk's.
 *
 *   sim(q, c) = Σ qᵢ · cᵢ
 *
 * No approximate index: at this size a full scan takes well under a
 * millisecond, and "every chunk was compared" needs no caveat on screen.
 */
export function searchDense(vectors: Float32Array, dims: number, query: Float32Array, k: number): { hits: Hit[]; scores: Float32Array } {
  const count = vectors.length / dims;
  const scores = new Float32Array(count);
  for (let i = 0; i < count; i++) scores[i] = dot(query, row(vectors, dims, i));
  const hits = ranking(scores)
    .slice(0, k)
    .map((chunk, i): Hit => ({ chunk, score: scores[chunk], rank: i + 1 }));
  return { hits, scores };
}
