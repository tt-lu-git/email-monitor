import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger, withTiming } from './logger';

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits valid JSON to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info({ event: 'test.event', method: 'test' });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('test.event');
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never logs email-shaped content (no "subject" or "body" keys)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info({ event: 'email.processed', method: 'webhook', messageId: 'abc123' });
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).not.toHaveProperty('subject');
    expect(parsed).not.toHaveProperty('body');
  });

  it('withTiming appends durationMs on success', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await withTiming('gmail.fetch', async () => 'value');
    expect(result).toBe('value');
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.durationMs).toBeTypeOf('number');
  });

  it('withTiming logs error and re-throws on failure', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      withTiming('failing.op', async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.error).toContain('boom');
  });
});
