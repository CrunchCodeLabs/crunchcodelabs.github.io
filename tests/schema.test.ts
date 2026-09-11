import { describe, it, expect } from 'vitest';
import { appSchema } from '../src/content.config';

const valid = {
  name: 'My Book Trail',
  tagline: 'Track every book you have read, are reading, and wishing for.',
  category: 'Books & Reference',
  status: 'live' as const,
  order: 1,
  accent: '#1EB8AC',
  accentDeep: '#12201F',
  packageId: 'com.crunchcodelabs.mybooktrail',
  version: '1.30',
  platforms: ['android' as const],
  playUrl: 'https://play.google.com/store/apps/details?id=com.crunchcodelabs.mybooktrail',
  icon: 'my-book-trail/icon.png',
  screenshots: ['my-book-trail/screens/01-your-library.png'],
  features: [{ title: 'Works offline', body: 'Your library lives on your device.' }],
  support: { email: 'crunchcodelabs@gmail.com' },
};

describe('app schema', () => {
  it('accepts a complete entry', () => {
    expect(appSchema.parse(valid)).toMatchObject({ name: 'My Book Trail' });
  });

  it('requires playUrl when status is live', () => {
    const { playUrl, ...noUrl } = valid;
    expect(() => appSchema.parse({ ...noUrl, status: 'live' })).toThrow(/playUrl/);
  });

  it('allows a coming-soon app with no store link', () => {
    const { playUrl, ...noUrl } = valid;
    expect(() => appSchema.parse({ ...noUrl, status: 'coming-soon' })).not.toThrow();
  });

  it('allows an empty screenshot list', () => {
    expect(() => appSchema.parse({ ...valid, screenshots: [] })).not.toThrow();
  });

  it('rejects a non-hex accent', () => {
    expect(() => appSchema.parse({ ...valid, accent: 'teal' })).toThrow();
  });

  it('rejects an unknown platform', () => {
    expect(() => appSchema.parse({ ...valid, platforms: ['windows'] })).toThrow();
  });

  it('requires at least one feature and at most six', () => {
    expect(() => appSchema.parse({ ...valid, features: [] })).toThrow();
    expect(() => appSchema.parse({ ...valid, features: Array(7).fill(valid.features[0]) })).toThrow();
  });

  it('keeps nativeName optional', () => {
    expect(appSchema.parse({ ...valid, nativeName: 'ශුද්ධ ගණිතය සූත්‍ර' }).nativeName)
      .toBe('ශුද්ධ ගණිතය සූත්‍ර');
    expect(appSchema.parse(valid).nativeName).toBeUndefined();
  });
});
