import { ranking } from "./similarity";
import { squash } from "./tokenize";
import { stepOf, type Index, type QueryTrace } from "./types";

/** A question with a known answer: retrieval passes when a retrieved chunk contains `expect` (and `near`, when given). */
export interface TestQuestion {
  id: string;
  question: string;
  expect: string;
  near?: string;
}

export interface TestResult {
  id: string;
  /** Chunks that hold the answer. Empty when the chunking split it or the text is not in the documents. */
  holders: number[];
  /** Best rank of a holder in each list, or `null` when no holder is in it. */
  dense: number | null;
  sparse: number | null;
  fused: number | null;
  /** Whether a holder reached the prompt. */
  inContext: boolean;
}

/** Grades one finished query against its expected answer. No model involved. */
export function grade(index: Index, test: TestQuestion, trace: QueryTrace): TestResult {
  const expect = squash(test.expect);
  const near = test.near ? squash(test.near) : null;
  const holders: number[] = [];
  index.chunks.forEach((chunk, i) => {
    const text = squash(`${chunk.title ?? ""} ${chunk.text}`);
    if (text.includes(expect) && (!near || text.includes(near))) holders.push(i);
  });
  const best = (ranks: (number | undefined)[]) => {
    const found = ranks.filter((rank): rank is number => rank !== undefined);
    return found.length ? Math.min(...found) : null;
  };
  const dense = stepOf(trace, "dense");
  const sparse = stepOf(trace, "sparse");
  const fused = stepOf(trace, "fuse");
  const assembled = stepOf(trace, "assemble");
  // The dense rank is over every chunk, not only the top k, so a miss still says how far off it was.
  const denseOrder = dense ? ranking(dense.scores) : [];
  const inContext = assembled ? assembled.sources.some((source) => source.chunks.some((chunk) => holders.includes(chunk))) : false;
  return {
    id: test.id,
    holders,
    dense: best(holders.map((holder) => (denseOrder.indexOf(holder) >= 0 ? denseOrder.indexOf(holder) + 1 : undefined))),
    sparse: best(holders.map((holder) => sparse?.hits.find((hit) => hit.chunk === holder)?.rank)),
    fused: best(holders.map((holder) => fused?.hits.find((hit) => hit.chunk === holder)?.rank)),
    inContext,
  };
}

/** Share of the tests whose answer reached the context, and the mean reciprocal rank in the fused list. */
export function summarize(results: TestResult[]): { recall: number; mrr: number } {
  if (!results.length) return { recall: 0, mrr: 0 };
  const recall = results.filter((result) => result.inContext).length / results.length;
  const mrr = results.reduce((sum, result) => sum + (result.fused ? 1 / result.fused : 0), 0) / results.length;
  return { recall, mrr };
}
