import { describe, it, expect } from 'vitest';
import { assetKey } from '../src/lib/images';

describe('assetKey', () => {
  it('builds a glob key under src/assets/apps', () => {
    expect(assetKey('my-book-trail/icon.png')).toBe('/src/assets/apps/my-book-trail/icon.png');
  });

  it('tolerates a leading slash', () => {
    expect(assetKey('/my-book-trail/icon.png')).toBe('/src/assets/apps/my-book-trail/icon.png');
  });

  it('rejects traversal out of the assets directory', () => {
    expect(() => assetKey('../../secrets.png')).toThrow(/traversal/i);
  });
});
