/**
 * Best-effort PDF text extractor for Cloudflare Workers (no native PDF libs).
 * Handles uncompressed text streams (common in transactional/invoice PDFs).
 * Won't decode zlib-compressed streams, but blanks them out first to avoid
 * false-positive binary garbage from BT/ET regex matches inside binary data.
 */
export function extractPdfText(bytes: Uint8Array, maxChars = 2000): string {
  const raw = new TextDecoder('latin1').decode(bytes);

  // Blank out stream...endstream blocks before scanning for BT/ET.
  // This prevents the BT/ET regex from matching inside compressed binary content.
  const blanked = raw.replace(/stream[\r\n][\s\S]*?endstream/g, 'stream endstream');

  const texts: string[] = [];
  let totalLen = 0;

  const btRegex = /BT\b([\s\S]*?)\bET\b/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = btRegex.exec(blanked)) !== null) {
    if (totalLen >= maxChars) break;
    const block = btMatch[1] ?? '';

    // Parenthesized string literals: (text)
    const parenRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = parenRegex.exec(block)) !== null) {
      const text = (m[1] ?? '')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .replace(/\\(\d{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));
      if (text.trim().length > 1) {
        texts.push(text);
        totalLen += text.length;
      }
    }

    // Hex string literals: <4869> → decoded ASCII/latin1 characters
    const hexRegex = /<([0-9A-Fa-f]+)>/g;
    while ((m = hexRegex.exec(block)) !== null) {
      const hex = m[1] ?? '';
      let text = '';
      for (let i = 0; i + 1 < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code >= 0x20 && code < 0x7f) text += String.fromCharCode(code);
      }
      if (text.trim().length > 1) {
        texts.push(text);
        totalLen += text.length;
      }
    }
  }

  return texts.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}
