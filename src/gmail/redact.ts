export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"');
}

export function redactPII(text: string): string {
  return text
    // PEM blocks
    .replace(/-----BEGIN[\s\S]+?-----END[^-]+-----/g, '[REDACTED]')
    // AWS access keys
    .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED]')
    // Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]')
    // SSN
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]')
    // Credit cards (13-16 digits, possible spaces/dashes)
    .replace(/\b(?:\d[ -]?){13,16}\b/g, '[REDACTED]')
    // OTP: keyword before digits
    .replace(/(?:code|verification|otp|pin|one.time)[^\d]*\b(\d{4,8})\b/gi, (m, p1: string) => m.replace(p1, '[REDACTED]'))
    // OTP: digits before keyword
    .replace(/\b(\d{4,8})\b(?=[^\d]*(?:code|verification|otp|pin|one.time))/gi, '[REDACTED]');
}
