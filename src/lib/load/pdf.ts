/**
 * Text out of a PDF, in the browser or in Node. Pages are joined with a
 * line break: a clause that runs over a page break stays one passage.
 * A scanned PDF has no text layer and yields nothing; the caller says so.
 */
export async function pdfText(data: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { text: text.join("\n"), pages: totalPages };
}
