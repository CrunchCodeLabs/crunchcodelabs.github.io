import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, onColor, WHITE, INK } from '../src/lib/contrast';

describe('contrast', () => {
  it('computes known luminance endpoints', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#6C63FF', WHITE)).toBeCloseTo(contrastRatio(WHITE, '#6C63FF'), 10);
  });

  it('matches measured ratios for the brand palette', () => {
    expect(contrastRatio('#6C63FF', WHITE)).toBeCloseTo(4.32, 1);
    expect(contrastRatio('#4B42D6', WHITE)).toBeCloseTo(6.89, 1);
    expect(contrastRatio('#1EB8AC', WHITE)).toBeCloseTo(2.47, 1);
    expect(contrastRatio('#12201F', WHITE)).toBeCloseTo(16.77, 1);
  });

  it('picks ink over the My Book Trail teal, where white would fail', () => {
    expect(onColor('#1EB8AC')).toBe(INK);
  });

  it('picks white over both deep accents, which is where hero text sits', () => {
    expect(onColor('#4B42D6')).toBe(WHITE);
    expect(onColor('#12201F')).toBe(WHITE);
  });

  it('accepts shorthand hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });

  it('rejects a malformed hex so a bad accent fails the build', () => {
    expect(() => relativeLuminance('6C63FF')).toThrow(/hex/i);
    expect(() => relativeLuminance('#GGGGGG')).toThrow(/hex/i);
  });
});
