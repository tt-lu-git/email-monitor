import type { ClassificationResult, EmailInput } from './types';
import rulesConfig from './rules.json';

function isTrusted(email: EmailInput): boolean {
  const fromAddr = email.from.match(/<([^>]+)>/)?.[1] ?? email.from;
  const lower = fromAddr.toLowerCase();
  return rulesConfig.allowlist.some(entry =>
    entry.startsWith('@')
      ? lower.endsWith(entry.toLowerCase())
      : lower === entry.toLowerCase()
  );
}

export function applyRules(email: EmailInput): ClassificationResult | null {
  // Trusted senders bypass all label-based rules and go straight to AI
  if (isTrusted(email)) return null;

  // Ignore: promotional/social/spam labels — discard without AI
  for (const label of rulesConfig.ignoreLabels) {
    if (email.labels.includes(label)) {
      return { priority: 'Ignore', summary: email.subject.slice(0, 80), label: 'Ads', method: 'rule' };
    }
  }

  // Not Necessary: newsletters with unsubscribe header — batch daily without AI
  if (email.headers['list-unsubscribe']) {
    return { priority: 'Not Necessary', summary: email.subject.slice(0, 80), label: 'Newsletter', method: 'rule' };
  }

  // Everything else goes to AI
  return null;
}
