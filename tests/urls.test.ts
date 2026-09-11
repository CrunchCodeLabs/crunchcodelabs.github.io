import { describe, it, expect } from 'vitest';
import { SITE, appPath, privacyPath, termsPath, absolute } from '../src/lib/urls';

describe('urls', () => {
  it('builds app paths with a trailing slash', () => {
    expect(appPath('my-book-trail')).toBe('/apps/my-book-trail/');
  });

  it('builds legal paths', () => {
    expect(privacyPath('my-book-trail')).toBe('/apps/my-book-trail/privacy/');
    expect(termsPath('my-book-trail')).toBe('/apps/my-book-trail/terms/');
  });

  it('has no base path in the site origin', () => {
    expect(SITE).toBe('https://crunchcodelabs.github.io');
    expect(new URL(SITE).pathname).toBe('/');
  });

  it('makes absolute URLs for canonical tags', () => {
    expect(absolute('/apps/my-book-trail/privacy/'))
      .toBe('https://crunchcodelabs.github.io/apps/my-book-trail/privacy/');
  });

  it('rejects a slug that is not URL-safe', () => {
    expect(() => appPath('My Book Trail')).toThrow(/slug/i);
  });
});
