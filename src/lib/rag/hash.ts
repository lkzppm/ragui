/**
 * A short, stable id for a piece of text: two 32-bit FNV-1a passes with
 * different offsets, as 16 hex digits. Not cryptographic; it only has to be
 * the same on every machine, so ids never depend on a counter or a clock.
 */
export function hash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ (code + i), 0x85ebca6b);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
