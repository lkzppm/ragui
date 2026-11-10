import { dot, row } from "./similarity";
import type { DroppedHit, Hit } from "./types";

/**
 * Maximal Marginal Relevance: picks `limit` chunks one at a time,
 *
 *   next = argmax_c  λ · rel(c) − (1 − λ) · max_s sim(c, s)
 *
 * where `s` runs over the chunks already picked. `rel` is the candidate's
 * place in the fused ranking scaled to 0..1 (first is 1), because fused
 * scores are too flat to weigh against a similarity; `sim` is the cosine
 * between the two chunks. With λ = 1 it returns the top `limit` unchanged.
 *
 * A candidate is reported as dropped when it ranked above a kept one and
 * was passed over: the chunk it was too close to is named.
 */
export function diversify(candidates: Hit[], vectors: Float32Array, dims: number, lambda: number, limit: number): { kept: Hit[]; dropped: DroppedHit[] } {
  const total = candidates.length;
  const relevance = (position: number) => (total > 1 ? 1 - position / (total - 1) : 1);
  const picked: number[] = [];
  const kept: Hit[] = [];
  const remaining = candidates.map((_, i) => i);

  while (kept.length < limit && remaining.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (const position of remaining) {
      let redundancy = 0;
      for (const other of picked) {
        redundancy = Math.max(redundancy, dot(row(vectors, dims, candidates[position].chunk), row(vectors, dims, candidates[other].chunk)));
      }
      const score = lambda * relevance(position) - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        best = position;
      }
    }
    remaining.splice(remaining.indexOf(best), 1);
    picked.push(best);
    kept.push({ chunk: candidates[best].chunk, score: bestScore, rank: kept.length + 1 });
  }

  const lastKept = Math.max(-1, ...picked);
  const dropped: DroppedHit[] = [];
  for (const position of remaining) {
    if (position > lastKept) continue;
    let tooCloseTo = candidates[picked[0]].chunk;
    let similarity = -Infinity;
    for (const other of picked) {
      const sim = dot(row(vectors, dims, candidates[position].chunk), row(vectors, dims, candidates[other].chunk));
      if (sim > similarity) {
        similarity = sim;
        tooCloseTo = candidates[other].chunk;
      }
    }
    dropped.push({ ...candidates[position], tooCloseTo, similarity });
  }
  return { kept, dropped };
}
