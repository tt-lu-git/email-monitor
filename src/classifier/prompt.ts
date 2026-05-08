import type { EmailInput } from './types';

const SYSTEM = `You are an email classifier. For each email output priority, a summary, and a label.

Priority rules:
Critical: requires immediate action — security alerts, OTPs, outages, payment issues, urgent requests
High: important, needs attention soon — meetings, deadlines, direct questions, time-sensitive billing
Medium: useful but not urgent — project updates, FYIs, newsletters from known contacts; also order confirmations, delivery updates, and routine billing/invoices (use High if the order/billing needs immediate attention)
Low: minor informational — automated status updates, low-value notifications
Not Necessary: no action needed, purely informational — digests, routine system reports, subscription pings
Ignore: ads, promotions, social media notifications, marketing, spam, scam attempts — output this and nothing else will be sent

Order/billing rule: emails about order confirmations, delivery tracking, or billing statements should be Medium at minimum. Use High if the email requires immediate action (e.g. payment failed, dispute window closing).

Summary rules: write ONE sentence that tells the reader what happened and what (if anything) they should do.
Do NOT just restate the subject line. Add context or action.
Good: "Acme Bank charged $42.00 for CloudStore — verify this purchase or dispute if unrecognized."
Good: "Team sync with Jordan moved to 3pm Friday — update your calendar."
Bad: "CloudStore Invoice: $42.00 USD" (just the subject)

Label rules: pick ONE short label (1-2 words, no spaces, TitleCase) describing the email's purpose.
Examples: Bills, Newsletter, Work, Social, Shopping, Travel, Alert, Receipt, Calendar, Personal, Ads, Updates

Respond with ONLY valid JSON, priority field first:
{"priority":"Critical|High|Medium|Low|Not Necessary|Ignore","summary":"one actionable sentence max 120 chars","label":"TitleCaseLabel"}`;

export function buildPrompt(email: EmailInput): { system: string; user: string } {
  const body = (email.bodyText.trim() || email.snippet).slice(0, 800);
  const parts = [`From: ${email.from}`, `Subject: ${email.subject}`, `Body: ${body}`];
  const attach = email.attachmentText.trim().slice(0, 1000);
  if (attach) parts.push(`Attachment text: ${attach}`);
  return {
    system: SYSTEM,
    user:   parts.join('\n'),
  };
}
