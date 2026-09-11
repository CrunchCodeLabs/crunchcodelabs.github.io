import { describe, it, expect } from 'vitest';
import { byOrder, isLaunched } from '../src/lib/apps';

const mk = (slug: string, order: number, status: 'live' | 'beta' | 'coming-soon') =>
  ({ id: slug, data: { order, status } }) as any;

describe('app helpers', () => {
  it('sorts by the order field', () => {
    const sorted = [mk('b', 2, 'live'), mk('a', 1, 'live')].sort(byOrder);
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('treats live and beta as launched, coming-soon as not', () => {
    expect(isLaunched(mk('a', 1, 'live'))).toBe(true);
    expect(isLaunched(mk('b', 2, 'beta'))).toBe(true);
    expect(isLaunched(mk('c', 3, 'coming-soon'))).toBe(false);
  });
});
