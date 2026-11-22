import { describe, it, expect } from 'vitest';
import { formatRulerLabel } from '../RulerView';

describe('formatRulerLabel', () => {
  it('shows mm:ss when labels are at least a second apart', () => {
    expect(formatRulerLabel(0, 10)).toBe('00:00');
    expect(formatRulerLabel(75.9, 5)).toBe('01:15');
  });

  it('adds hundredths at deep zoom so neighbouring labels differ', () => {
    const step = 0.177; // 100 px at 1.77 ms/px
    const labels = [0, 1, 2, 3, 4, 5].map(i => formatRulerLabel(i * step, step));

    expect(labels).toEqual([
      '00:00.00',
      '00:00.18',
      '00:00.35',
      '00:00.53',
      '00:00.71',
      '00:00.89'
    ]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('shows 00:00 while the scale is not known yet', () => {
    expect(formatRulerLabel(NaN, NaN)).toBe('00:00');
  });

  it('carries rounded hundredths into the next second', () => {
    expect(formatRulerLabel(59.996, 0.5)).toBe('01:00.00');
  });
});
