import type { RetrieveMode } from "./settings";
import type { FusedHit, Hit } from "./types";

/**
 * Reciprocal Rank Fusion. A cosine and a BM25 score are on different
 * scales, so the lists are merged by position:
 *
 *   rrf(c) = Σ_L 1 / (k + rank_L(c))
 *
 * In `dense` or `sparse` mode one list passes through with its own scores.
 */
export function fuse(dense: Hit[], sparse: Hit[], mode: RetrieveMode, k: number): FusedHit[] {
  const denseRank = new Map(dense.map((hit) => [hit.chunk, hit.rank]));
  const sparseRank = new Map(sparse.map((hit) => [hit.chunk, hit.rank]));
  const lists: Hit[][] = mode === "dense" ? [dense] : mode === "sparse" ? [sparse] : [dense, sparse];
  const scores = new Map<number, number>();
  for (const list of lists) {
    for (const hit of list) scores.set(hit.chunk, (scores.get(hit.chunk) ?? 0) + (mode === "hybrid" ? 1 / (k + hit.rank) : hit.score));
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([chunk, score], i) => ({
      chunk,
      score,
      rank: i + 1,
      denseRank: denseRank.get(chunk) ?? null,
      sparseRank: sparseRank.get(chunk) ?? null,
    }));
}
