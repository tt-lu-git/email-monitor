import { describe, it, expect } from 'vitest';
import { applyRules } from './rules';
import type { EmailInput } from './types';

const base: EmailInput = {
  id: 'x', threadId: 'x', snippet: '', bodyText: '',
  attachmentText: '', images: [],
  date: '', labels: [],
  headers: {},
  from: 'unknown@example.com', subject: 'Hello',
};

describe('applyRules', () => {
  it('returns null when no rule matches — goes to AI', () => {
    expect(applyRules(base)).toBeNull();
  });

  it('returns null for regular email — AI decides priority', () => {
    expect(applyRules({ ...base, subject: 'Meeting at 3pm' })).toBeNull();
  });

  it('CATEGORY_PROMOTIONS label → Ignore', () => {
    expect(applyRules({ ...base, labels: ['CATEGORY_PROMOTIONS'] })?.priority).toBe('Ignore');
  });

  it('CATEGORY_SOCIAL label → Ignore', () => {
    expect(applyRules({ ...base, labels: ['CATEGORY_SOCIAL'] })?.priority).toBe('Ignore');
  });

  it('SPAM label → Ignore', () => {
    expect(applyRules({ ...base, labels: ['SPAM'] })?.priority).toBe('Ignore');
  });

  it('List-Unsubscribe header → Not Necessary', () => {
    expect(applyRules({ ...base, headers: { 'list-unsubscribe': '<mailto:u@list.com>' } })?.priority).toBe('Not Necessary');
  });

  it('Ignore takes precedence over Not Necessary', () => {
    const result = applyRules({
      ...base,
      labels: ['CATEGORY_PROMOTIONS'],
      headers: { 'list-unsubscribe': '<mailto:u@list.com>' },
    });
    expect(result?.priority).toBe('Ignore');
  });

  it('STARRED label → null (goes to AI, not auto-Critical)', () => {
    expect(applyRules({ ...base, labels: ['STARRED'] })).toBeNull();
  });

  it('urgent subject → null (goes to AI, not auto-Critical)', () => {
    expect(applyRules({ ...base, subject: 'URGENT: please read' })).toBeNull();
  });

  it('allowlisted domain bypasses Ignore even if CATEGORY_PROMOTIONS', () => {
    const result = applyRules({
      ...base,
      from: 'Updates <notify@yourcompany.com>',
      labels: ['CATEGORY_PROMOTIONS'],
    });
    expect(result).toBeNull(); // goes to AI
  });

  it('non-allowlisted CATEGORY_PROMOTIONS still Ignored', () => {
    expect(applyRules({ ...base, labels: ['CATEGORY_PROMOTIONS'] })?.priority).toBe('Ignore');
  });
});
