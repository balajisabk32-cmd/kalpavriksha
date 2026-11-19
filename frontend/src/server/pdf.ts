/** Small checks on uploaded PDFs, without a PDF library. */

export function isPdf(data: Uint8Array): boolean {
  // "%PDF-" within the first 1 KB (some files have a few junk bytes first).
  const head = new TextDecoder("latin1").decode(data.subarray(0, 1024));
  return head.includes("%PDF-");
}

/**
 * Page count from the document's page tree: the largest "/Count n" on a
 * "/Type /Pages" object. Null when the tree is compressed and can't be read
 * this way — the admin then types the number.
 */
export function pdfPageCount(data: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(data);
  let best = 0;
  const re = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g;
  for (const m of text.matchAll(re)) best = Math.max(best, Number(m[1] ?? m[2]));
  return best > 0 && best < 5000 ? best : null;
}
