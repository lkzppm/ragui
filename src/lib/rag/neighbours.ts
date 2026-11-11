import { searchDense } from "./dense";
import type { Hit } from "./types";

/** The `k` chunks most similar to chunk `i`, itself left out. Exact: the same scan as the dense search. */
export function neighboursOf(vectors: Float32Array, dims: number, i: number, k: number): Hit[] {
  return searchDense(vectors, dims, vectors.subarray(i * dims, (i + 1) * dims), k + 1)
    .hits.filter((hit) => hit.chunk !== i)
    .slice(0, k)
    .map((hit, position) => ({ ...hit, rank: position + 1 }));
}

/** An undirected link between two chunks, `a < b`, with their cosine. */
export interface Link {
  a: number;
  b: number;
  score: number;
}

/**
 * The graph of the corpus: each chunk joined to its `k` nearest, a link
 * kept once whichever end it came from. Every pair is compared, so this
 * is for a corpus small enough to draw.
 */
export function mesh(vectors: Float32Array, dims: number, k: number): Link[] {
  const count = vectors.length / dims;
  const links = new Map<number, Link>();
  for (let i = 0; i < count; i++) {
    for (const hit of neighboursOf(vectors, dims, i, k)) {
      const a = Math.min(i, hit.chunk);
      const b = Math.max(i, hit.chunk);
      links.set(a * count + b, { a, b, score: hit.score });
    }
  }
  return [...links.values()].sort((x, y) => x.a - y.a || x.b - y.b);
}
