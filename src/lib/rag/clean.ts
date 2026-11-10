/**
 * Makes extracted text regular before anything measures or cuts it. Every
 * later offset (a chunk's start and end, a citation) refers to the result,
 * so this runs once per document and its output is what is kept.
 */

const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };

export function clean(raw: string): string {
  return (
    raw
      // Not NFKC: it would also rewrite "nº" as "no".
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .replace(/[ﬀ-ﬆ]/g, (ligature) => LIGATURES[ligature] ?? ligature)
      // Bullets drawn with a symbol font arrive as private-use characters.
      .replace(/^[ \t]*[-•◦▪‣·][ \t]*/gm, "- ")
      .replace(/[-]/g, "")
      .replace(/[  -  　]/g, " ")
      .replace(/[​-‍﻿]/g, "")
      // Signature and form lines: a long rule says nothing more than a short one.
      .replace(/([_\-=.*])\1{3,}/g, "$1$1$1")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
