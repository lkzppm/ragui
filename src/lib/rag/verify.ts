import { tokenize } from "./tokenize";
import type { AnswerSentence, CitationCheck, Source } from "./types";

/**
 * Some models write citations their own way: gpt-oss uses "【4】" or
 * "【4†L1-L3】" whatever the prompt says. This rewrites them as "[4]", so
 * one format reaches the screen and the checks below.
 */
export function normalizeCitations(answer: string): string {
  return answer.replace(/\s*【\s*(\d+)[^】]*】/g, " [$1]").replace(/\[(\d+)†[^\]]*\]/g, "[$1]");
}

/** Splits an answer into sentences, keeping each one's position and the sources it cites. */
export function sentencesOf(answer: string): AnswerSentence[] {
  const out: AnswerSentence[] = [];
  // A sentence runs to ". ", "! " or "? " (plus any citations right after), or to a line break.
  const pattern = /[^\n]+?(?:[.!?]+(?:\s*\[[\d,\s]+\])*(?=\s|$)|(?=\n|$))/g;
  for (const match of answer.matchAll(pattern)) {
    const text = match[0];
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    const start = match.index + (text.length - text.trimStart().length);
    const citations = [...text.matchAll(/\[([\d,\s]+)\]/g)].flatMap((citation) =>
      citation[1]
        .split(",")
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((n) => Number.isFinite(n)),
    );
    out.push({ text: text.trim(), start, end: start + text.trim().length, citations: [...new Set(citations)] });
  }
  return out;
}

/**
 * Reads the answer back, in code:
 * - a citation must be the number of a source that was sent;
 * - for a valid one, the share of the sentence's longer words that occur in
 *   the cited source is a rough support score (lexical: it catches a number
 *   pasted on an unrelated sentence, not a subtle misreading);
 * - a sentence with no citation is listed, unless the answer cites nothing
 *   at all, which is how "the documents do not say" looks.
 */
export function verify(answer: string, sources: Pick<Source, "n" | "text" | "title">[]): { sentences: AnswerSentence[]; citations: CitationCheck[]; uncited: number[] } {
  const sentences = sentencesOf(answer);
  const words = new Map(sources.map((source) => [source.n, new Set(tokenize(`${source.title ?? ""} ${source.text}`))]));
  const citations: CitationCheck[] = [];
  const uncited: number[] = [];
  sentences.forEach((sentence, index) => {
    if (sentence.citations.length === 0) {
      uncited.push(index);
      return;
    }
    const content = tokenize(sentence.text.replace(/\[[\d,\s]+\]/g, " ")).filter((word) => word.length >= 4 || /\d/.test(word));
    for (const n of sentence.citations) {
      const source = words.get(n);
      if (!source) {
        citations.push({ sentence: index, n, valid: false, support: null });
        continue;
      }
      const found = content.filter((word) => source.has(word)).length;
      citations.push({ sentence: index, n, valid: true, support: content.length ? found / content.length : null });
    }
  });
  const citedNothing = citations.length === 0;
  return { sentences, citations, uncited: citedNothing ? [] : uncited };
}
