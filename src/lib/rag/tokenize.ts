/**
 * Words for the keyword search: lowercase, accents removed, split on
 * anything that is not a letter or a digit, single characters dropped.
 * No stemming and no stop-word list: "locatário" and "locatária" stay
 * different words, and a word in every passage gets a low weight from its
 * idf instead of being hidden. Both choices are visible in the term table.
 */
export function tokenize(text: string): string[] {
  const words = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u);
  const out: string[] = [];
  for (const word of words) if (word.length > 1) out.push(word);
  return out;
}

/** Text as compared when looking for an expected answer: accents and case kept, spaces regular. */
export function squash(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}
