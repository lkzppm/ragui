import { ranking } from "./similarity";
import { tokenize } from "./tokenize";
import type { SparseHit, SparseIndex, TermStat } from "./types";

export function buildSparseIndex(texts: string[]): SparseIndex {
  const tf: Map<string, number>[] = [];
  const df = new Map<string, number>();
  const lengths: number[] = [];
  for (const text of texts) {
    const counts = new Map<string, number>();
    const words = tokenize(text);
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const word of counts.keys()) df.set(word, (df.get(word) ?? 0) + 1);
    tf.push(counts);
    lengths.push(words.length);
  }
  const avgLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  return { tf, df, lengths, avgLength };
}

/**
 * BM25:
 *
 *   score(q, c) = Σₜ idf(t) · f(t,c) · (k₁ + 1) / (f(t,c) + k₁ · (1 − b + b · |c| / avg))
 *   idf(t)      = ln(1 + (N − n(t) + 0.5) / (n(t) + 0.5))
 *
 * A chunk with none of the question's words is not a hit at all.
 */
export function searchSparse(index: SparseIndex, question: string, k: number, k1: number, b: number): { terms: TermStat[]; hits: SparseHit[] } {
  const count = index.tf.length;
  const unique = [...new Set(tokenize(question))];
  const terms: TermStat[] = unique.map((term) => {
    const df = index.df.get(term) ?? 0;
    return { term, df, idf: Math.log(1 + (count - df + 0.5) / (df + 0.5)) };
  });
  const scores = new Float64Array(count);
  const matched: SparseHit["matched"][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < count; i++) {
    const norm = k1 * (1 - b + (b * index.lengths[i]) / (index.avgLength || 1));
    for (const { term, idf } of terms) {
      const tf = index.tf[i].get(term);
      if (!tf) continue;
      const score = (idf * tf * (k1 + 1)) / (tf + norm);
      scores[i] += score;
      matched[i].push({ term, tf, score });
    }
  }
  const hits: SparseHit[] = [];
  for (const chunk of ranking(scores)) {
    if (hits.length >= k || scores[chunk] <= 0) break;
    hits.push({ chunk, score: scores[chunk], rank: hits.length + 1, matched: matched[chunk] });
  }
  return { terms, hits };
}
