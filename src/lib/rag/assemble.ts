import type { ContextOrder } from "./settings";
import type { Hit, Index, Source } from "./types";

/**
 * Packs the chosen chunks into the context, in order, while they fit:
 *
 *   Σ tokens(sourceᵢ) ≤ budget
 *
 * Chunks that touch or overlap in the same document become one source, so
 * an overlap is not paid for twice. What does not fit is returned, not
 * hidden. Tokens are the embedder's count: the model that answers has its
 * own tokenizer, and its real count comes back with the answer.
 */
export function assemble(index: Index, kept: Hit[], budget: number, order: ContextOrder): { sources: Source[]; tokens: number; leftOut: Hit[] } {
  const groups: { chunks: number[]; docId: string; start: number; end: number; first: number }[] = [];
  const leftOut: Hit[] = [];
  let used = 0;

  kept.forEach((hit, position) => {
    const chunk = index.chunks[hit.chunk];
    const neighbour = groups.find((group) => group.docId === chunk.docId && chunk.start <= group.end && chunk.end >= group.start);
    const doc = index.docs.find((d) => d.id === chunk.docId)!;
    const span = neighbour ? { start: Math.min(neighbour.start, chunk.start), end: Math.max(neighbour.end, chunk.end) } : { start: chunk.start, end: chunk.end };
    // Only the text this chunk adds is new cost.
    const added = neighbour ? span.end - span.start - (neighbour.end - neighbour.start) : chunk.end - chunk.start;
    const cost = Math.ceil(tokensPerChar(index, hit.chunk) * added);
    if (used + cost > budget && groups.length > 0) {
      leftOut.push(hit);
      return;
    }
    used += cost;
    if (neighbour) {
      neighbour.chunks.push(hit.chunk);
      neighbour.start = span.start;
      neighbour.end = span.end;
    } else {
      groups.push({ chunks: [hit.chunk], docId: doc.id, start: span.start, end: span.end, first: position });
    }
  });

  if (order === "document") {
    const docOrder = new Map(index.docs.map((doc, i) => [doc.id, i]));
    groups.sort((a, b) => docOrder.get(a.docId)! - docOrder.get(b.docId)! || a.start - b.start);
  } else {
    groups.sort((a, b) => a.first - b.first);
  }

  let total = 0;
  const sources: Source[] = groups.map((group, i) => {
    const doc = index.docs.find((d) => d.id === group.docId)!;
    const text = doc.text.slice(group.start, group.end);
    const tokens = Math.ceil(tokensPerChar(index, group.chunks[0]) * text.length);
    total += tokens;
    const title = index.chunks[Math.min(...group.chunks)].title;
    return { n: i + 1, docId: doc.id, title, chunks: [...group.chunks].sort((a, b) => a - b), start: group.start, end: group.end, text, tokens };
  });
  return { sources, tokens: total, leftOut };
}

/** A chunk's token density, from the embedder's count; about four characters a token when it is unknown. */
function tokensPerChar(index: Index, chunk: number): number {
  const { tokens, text } = index.chunks[chunk];
  return tokens && text.length ? tokens / text.length : 0.25;
}
