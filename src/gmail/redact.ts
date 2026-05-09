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
    // Credit cards — only formatted numbers (groups of 4 separated by spaces or dashes)
    .replace(/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}\b/g, '[REDACTED]')
    ;
}
