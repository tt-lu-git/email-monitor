import { describe, it, expect } from 'vitest';
import { redactPII, stripHtml } from './redact';

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });
  it('decodes HTML entities', () => {
    expect(stripHtml('AT&amp;T &lt;test&gt; &nbsp;end')).toBe('AT&T <test>  end');
  });
});

describe('redactPII', () => {
  it('redacts OTP codes near keywords', () => {
    expect(redactPII('Your verification code is 482910')).toContain('[REDACTED]');
    expect(redactPII('Your verification code is 482910')).not.toContain('482910');
  });
  it('redacts credit card numbers', () => {
    expect(redactPII('Card: 4111111111111111 expires')).not.toContain('4111111111111111');
  });
  it('redacts SSN patterns', () => {
    expect(redactPII('SSN: 123-45-6789')).not.toContain('123-45-6789');
  });
  it('redacts Bearer tokens', () => {
    expect(redactPII('Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.abc')).not.toContain('eyJhb');
  });
  it('redacts AWS access keys', () => {
    expect(redactPII('Key: AKIAIOSFODNN7EXAMPLE')).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
  it('redacts PEM blocks', () => {
    expect(redactPII('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----')).not.toContain('BEGIN');
  });
  it('leaves clean text unchanged', () => {
    const text = 'Meeting at 3pm to discuss the roadmap.';
    expect(redactPII(text)).toBe(text);
  });
});
