import type { EmailMessage } from './types';
import { stripHtml, redactPII } from './redact';
import { extractPdfText } from './pdf';

const MAX_BODY_CHARS       = 2048;
const MAX_ATTACH_CHARS     = 2000;
const MAX_IMAGES           = 5;
const MAX_IMAGE_BYTES      = 1024 * 1024; // 1 MB raw

interface GmailMessagePart {
  mimeType:  string;
  filename?: string;
  headers?:  Array<{ name: string; value: string }>;
  body:      { data?: string; size: number; attachmentId?: string };
  parts?:    GmailMessagePart[];
}

function decodeBase64url(data: string): Uint8Array {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

async function fetchAttachmentBytes(
  messageId:    string,
  attachmentId: string,
  accessToken:  string
): Promise<Uint8Array> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`gmail:attachment.get:${res.status}`);
  const data = await res.json<{ data: string }>();
  return decodeBase64url(data.data);
}

async function getPartBytes(
  part:        GmailMessagePart,
  messageId:   string,
  accessToken: string,
  maxBytes:    number
): Promise<Uint8Array | null> {
  if (part.body.size > maxBytes) return null;

  if (part.body.data) {
    return decodeBase64url(part.body.data);
  }
  if (part.body.attachmentId) {
    try {
      return await fetchAttachmentBytes(messageId, part.body.attachmentId, accessToken);
    } catch {
      return null;
    }
  }
  return null;
}

/** Extract plain-text body from a MIME part tree (first text/plain or stripped text/html). */
function extractBodyText(part: GmailMessagePart): string {
  if (part.mimeType === 'text/plain' && part.body.data) {
    return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  if (part.mimeType === 'text/html' && part.body.data) {
    return stripHtml(atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')));
  }
  if (part.parts) {
    for (const p of part.parts) {
      const text = extractBodyText(p);
      if (text) return text;
    }
  }
  return '';
}

interface Collected {
  attachmentText: string;
  images:         string[];
}

/** Walk MIME tree collecting PDF/TXT attachment text and images. Skips body text parts. */
async function collectAttachments(
  parts:       GmailMessagePart[],
  messageId:   string,
  accessToken: string,
  out:         Collected,
  seenCids:    Set<string>
): Promise<void> {
  for (const part of parts) {
    // Recurse into multipart containers
    if (part.parts) {
      await collectAttachments(part.parts, messageId, accessToken, out, seenCids);
      continue;
    }

    // Deduplicate inline images by Content-ID
    const cid = part.headers?.find(h => h.name.toLowerCase() === 'content-id')?.value;
    if (cid) {
      if (seenCids.has(cid)) continue;
      seenCids.add(cid);
    }

    const mimeType = (part.mimeType.split(';')[0] ?? part.mimeType).trim().toLowerCase();

    if (mimeType === 'application/pdf') {
      if (out.attachmentText.length >= MAX_ATTACH_CHARS) continue;
      const bytes = await getPartBytes(part, messageId, accessToken, MAX_IMAGE_BYTES);
      if (!bytes) continue;
      const extracted = extractPdfText(bytes, MAX_ATTACH_CHARS - out.attachmentText.length);
      const clean = redactPII(extracted).trim();
      if (clean) out.attachmentText += (out.attachmentText ? '\n' : '') + clean;

    } else if (mimeType === 'text/plain' && part.filename) {
      // Named text attachment (not the body)
      if (out.attachmentText.length >= MAX_ATTACH_CHARS) continue;
      const bytes = await getPartBytes(part, messageId, accessToken, MAX_IMAGE_BYTES);
      if (!bytes) continue;
      const remaining = MAX_ATTACH_CHARS - out.attachmentText.length;
      const text = redactPII(new TextDecoder().decode(bytes)).trim().slice(0, remaining);
      if (text) out.attachmentText += (out.attachmentText ? '\n' : '') + text;

    } else if (mimeType.startsWith('image/')) {
      if (out.images.length >= MAX_IMAGES) continue;
      const bytes = await getPartBytes(part, messageId, accessToken, MAX_IMAGE_BYTES);
      if (!bytes) continue;
      out.images.push(`data:${mimeType};base64,${uint8ToBase64(bytes)}`);
    }
  }
}

export async function fetchMessage(id: string, accessToken: string): Promise<EmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 401) throw new Error('gmail:auth:401');
  if (!res.ok) throw new Error(`gmail:messages.get:${res.status}`);

  const msg = await res.json<{
    id: string; threadId: string; snippet: string; labelIds: string[];
    payload: { headers: Array<{ name: string; value: string }>; } & GmailMessagePart;
  }>();

  const headers: Record<string, string> = {};
  for (const h of msg.payload.headers) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const bodyText = redactPII(extractBodyText(msg.payload)).slice(0, MAX_BODY_CHARS);

  const collected: Collected = { attachmentText: '', images: [] };
  await collectAttachments(
    msg.payload.parts ?? [],
    msg.id,
    accessToken,
    collected,
    new Set()
  );

  return {
    id:             msg.id,
    threadId:       msg.threadId,
    from:           headers['from'] ?? '',
    subject:        headers['subject'] ?? '',
    snippet:        msg.snippet,
    bodyText,
    attachmentText: collected.attachmentText,
    images:         collected.images,
    date:           headers['date'] ?? '',
    labels:         msg.labelIds ?? [],
    headers,
  };
}
