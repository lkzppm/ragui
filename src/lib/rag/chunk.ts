/**
 * Cuts a clean document into chunks. A chunk is a true slice of the text
 * (`text === doc.text.slice(start, end)`), so it can be drawn on the page
 * and cited by position. The three strategies share one packer: they differ
 * in the units they pack and in whether a heading starts a new chunk.
 */
import { hash } from "./hash";
import type { Settings } from "./settings";
import type { Chunk, Doc } from "./types";

interface Span {
  start: number;
  end: number;
}

/**
 * A heading: a Markdown `#` line, or a short line in capitals that either
 * ends with a colon or has at least two words ("LOCADOR:", "CLÁUSULA 4 –
 * DO VALOR DO ALUGUEL"). One bare capitalised word is not enough: it is as
 * often a label under a signature as a title.
 */
export function isHeading(line: string): boolean {
  const text = line.trim();
  if (text.length < 2 || text.length > 90) return false;
  if (/^#{1,6}\s+\S/.test(text)) return true;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3 || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return false;
  return text.endsWith(":") || text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length >= 2;
}

function headingText(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, "").replace(/:$/, "");
}

/** The lines of the text as spans, without their line breaks. */
function lines(text: string): Span[] {
  const out: Span[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      if (i > start) out.push({ start, end: i });
      start = i + 1;
    }
  }
  return out;
}

/**
 * Sentence-sized units inside [from, to): a unit ends after ". ", "? ",
 * "! ", ";" or ":" followed by a line break, or at a line break that
 * precedes a list item. Units cover the range with no gaps.
 */
function sentences(text: string, from: number, to: number): Span[] {
  const out: Span[] = [];
  let start = from;
  for (let i = from; i < to; i++) {
    const char = text[i];
    const next = text[i + 1];
    // "1. Manter o imóvel": the dot of a list number does not end a sentence.
    const listNumber = char === "." && /(^|\n)\d{1,3}$/.test(text.slice(Math.max(from, i - 4), i));
    const endsSentence = (char === "." || char === "?" || char === "!") && (next === " " || next === "\n") && !listNumber;
    const endsLine = char === "\n" && (/[.:;?!]/.test(text[i - 1] ?? "") || /^(- |\d+[.)] )/.test(text.slice(i + 1, i + 5)));
    if ((endsSentence || endsLine) && i + 1 < to) {
      out.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  if (start < to) out.push({ start, end: to });
  return out;
}

/** Splits a unit longer than `size` at word boundaries. */
function hardSplit(text: string, span: Span, size: number): Span[] {
  const out: Span[] = [];
  let start = span.start;
  while (span.end - start > size) {
    let cut = start + size;
    const space = text.lastIndexOf(" ", cut);
    const line = text.lastIndexOf("\n", cut);
    const boundary = Math.max(space, line);
    if (boundary > start + size / 2) cut = boundary + 1;
    out.push({ start, end: cut });
    start = cut;
  }
  if (start < span.end) out.push({ start, end: span.end });
  return out;
}

/** Packs units into chunks of at most `size` characters; each chunk starts with the tail of the one before, up to `overlap`. */
function pack(units: Span[], size: number, overlap: number): Span[] {
  const out: Span[] = [];
  let current: Span[] = [];
  const length = (spans: Span[]) => (spans.length ? spans[spans.length - 1].end - spans[0].start : 0);
  for (const unit of units) {
    if (current.length && length(current) + (unit.end - unit.start) > size) {
      out.push({ start: current[0].start, end: current[current.length - 1].end });
      // Carry whole units from the end while they fit in the overlap.
      const tail: Span[] = [];
      for (let i = current.length - 1; i >= 0 && overlap > 0; i--) {
        const candidate = [current[i], ...tail];
        if (length(candidate) > overlap) break;
        tail.unshift(current[i]);
      }
      current = tail;
    }
    current.push(unit);
  }
  if (current.length) out.push({ start: current[0].start, end: current[current.length - 1].end });
  return out;
}

function trimSpan(text: string, span: Span): Span {
  let { start, end } = span;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

export function chunk(doc: Doc, settings: Settings["chunk"]): Chunk[] {
  const { text } = doc;
  const size = Math.max(40, Math.round(settings.size));
  const overlap = Math.max(0, Math.min(Math.round(settings.overlap), Math.floor(size / 2)));
  const pieces: { span: Span; title: string | null }[] = [];

  if (settings.strategy === "fixed") {
    // Every `size` characters, moved back to a word boundary, stepping by size − overlap.
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf(" ", end), text.lastIndexOf("\n", end));
        if (boundary > start + size / 2) end = boundary;
      }
      pieces.push({ span: { start, end }, title: null });
      if (end >= text.length) break;
      let next = end - overlap;
      const boundary = Math.max(text.lastIndexOf(" ", next), text.lastIndexOf("\n", next));
      if (boundary > start) next = boundary + 1;
      start = Math.max(next, start + 1);
    }
  } else {
    // Sections: the whole document, or one per heading.
    const sections: { from: number; to: number; title: string | null }[] = [];
    if (settings.strategy === "structure") {
      let from = 0;
      let title: string | null = null;
      for (const line of lines(text)) {
        if (!isHeading(text.slice(line.start, line.end))) continue;
        if (line.start > from) sections.push({ from, to: line.start, title });
        from = line.start;
        title = headingText(text.slice(line.start, line.end));
      }
      sections.push({ from, to: text.length, title });
    } else {
      sections.push({ from: 0, to: text.length, title: null });
    }
    for (const section of sections) {
      const units = sentences(text, section.from, section.to).flatMap((unit) => hardSplit(text, unit, size));
      for (const span of pack(units, size, overlap)) pieces.push({ span, title: section.title });
    }
  }

  const chunks: Chunk[] = [];
  for (const piece of pieces) {
    const span = trimSpan(text, piece.span);
    if (span.end <= span.start) continue;
    chunks.push({
      id: hash(`${doc.id}:${span.start}:${span.end}`),
      docId: doc.id,
      index: -1,
      start: span.start,
      end: span.end,
      text: text.slice(span.start, span.end),
      title: piece.title,
      tokens: null,
      truncated: false,
    });
  }
  return chunks;
}

/**
 * What is embedded and indexed for a chunk: its section's heading, then its
 * text, unless the text already starts with that heading. A chunk that only
 * says "R$ 3.200,00, todo dia 05" still carries "DO VALOR DO ALUGUEL".
 */
export function chunkInput(chunk: Chunk): string {
  if (!chunk.title || chunk.text.startsWith(chunk.title)) return chunk.text;
  return `${chunk.title}\n${chunk.text}`;
}
