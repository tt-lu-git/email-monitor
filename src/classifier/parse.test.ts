import { describe, it, expect } from 'vitest';
import { parseAIResponse } from './parse';

describe('parseAIResponse', () => {
  it('parses valid JSON', () => {
    const result = parseAIResponse('{"priority":"High","summary":"Important meeting"}');
    expect(result?.priority).toBe('High');
    expect(result?.summary).toBe('Important meeting');
  });

  it('parses JSON wrapped in markdown fences', () => {
    const result = parseAIResponse('```json\n{"priority":"Low","summary":"Newsletter"}\n```');
    expect(result?.priority).toBe('Low');
  });

  it('truncates summary to 120 chars', () => {
    const long = 'x'.repeat(150);
    const result = parseAIResponse(`{"priority":"Medium","summary":"${long}"}`);
    expect(result?.summary).toHaveLength(120);
  });

  it('returns null for unknown priority', () => {
    expect(parseAIResponse('{"priority":"Urgent","summary":"x"}')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseAIResponse('not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAIResponse('')).toBeNull();
  });
});
