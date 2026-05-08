import type { NtfyPayload } from './types';
import type { PendingEmail } from '../db/pending';

type ImmediatePriority = 'Critical' | 'High' | 'Medium' | 'Low';
type BatchPriority     = 'High' | 'Medium' | 'Low' | 'Not Necessary';

const PRIORITY_MAP: Record<string, number> = {
  Critical: 5, High: 4, Medium: 3, Low: 2, 'Not Necessary': 1,
};
const TAGS_MAP: Record<string, string[]> = {
  Critical:        ['rotating_light'],
  High:            ['warning'],
  Medium:          ['envelope'],
  Low:             ['bell'],
  'Not Necessary': ['muted_speaker'],
};
const EMOJI_MAP: Record<string, string> = {
  Critical: '🔴', High: '🟠', Medium: '🟡', Low: '⚪', 'Not Necessary': '⚫',
};

function senderName(from: string): string {
  const display = from.match(/^(.+?)\s*</)?.[1]?.trim().replace(/^["']|["']$/g, '');
  return display || from.split('@')[0] || from;
}

function gmailLink(id: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${id}`;
}

/** Critical/immediate: single-email notification. */
export function formatImmediate(
  email: { from: string; subject: string; summary: string },
  priority: ImmediatePriority,
): NtfyPayload {
  const name = senderName(email.from);
  return {
    title:    `${EMOJI_MAP[priority]} ${name}: ${email.subject.slice(0, 60)}`,
    message:  email.summary,
    priority: PRIORITY_MAP[priority]!,
    tags:     TAGS_MAP[priority]!,
    markdown: true,
  };
}

/**
 * Batch notification.
 *
 * Title:   [3 emails] Marriott, Target, ParentSquare
 * Body:
 *   - **Marriott**: hotel stay confirmed, $1,000 folio [→](link)
 *   - **Target** (2):
 *     - order confirmed $30, arrives Jun 3
 *     - arrives Jun 3
 *     [→](link1) [→](link2)
 */
export function formatBatch(
  emails: PendingEmail[],
  priority: BatchPriority,
): NtfyPayload[] {
  if (emails.length === 0) return [];

  const CHUNK = 20;
  const chunks: PendingEmail[][] = [];
  for (let i = 0; i < emails.length; i += CHUNK) {
    chunks.push(emails.slice(i, i + CHUNK));
  }

  return chunks.map(chunk => {
    // Group by display name for same-sender collapsing
    const groups = new Map<string, PendingEmail[]>();
    for (const e of chunk) {
      const name = senderName(e.from_addr);
      const existing = groups.get(name);
      if (existing) existing.push(e);
      else groups.set(name, [e]);
    }

    // Title: [N emails] Name1, Name2, Name3 (+M more)
    const names = [...groups.keys()];
    const MAX_NAMES = 4;
    const shownNames = names.slice(0, MAX_NAMES).join(', ');
    const extra = names.length > MAX_NAMES ? ` +${names.length - MAX_NAMES} more` : '';
    const title = `[${chunk.length} email${chunk.length > 1 ? 's' : ''}] ${shownNames}${extra}`;

    // Body: one bullet per sender group
    const bullets = [...groups.entries()].map(([name, group]) => {
      if (group.length === 1) {
        const e = group[0]!;
        return `- **${name}**: ${e.summary} [link →](${gmailLink(e.id)})`;
      }
      // Multiple emails from same sender — list each summary on sub-bullets
      const links = group.map(e => `[link →](${gmailLink(e.id)})`).join(' ');
      const subItems = group.map(e => `  - ${e.summary}`).join('\n');
      return `- **${name}** (${group.length}):\n${subItems}\n  ${links}`;
    });

    return {
      title,
      message:  bullets.join('\n\n'),
      priority: PRIORITY_MAP[priority]!,
      tags:     TAGS_MAP[priority]!,
      markdown: true,
    };
  });
}
