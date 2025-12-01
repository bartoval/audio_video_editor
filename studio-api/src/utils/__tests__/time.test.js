const { formatDuration } = require('../time');

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('00:00.00');
  });

  it('formats seconds only', () => {
    expect(formatDuration(5)).toBe('00:05.00');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65)).toBe('01:05.00');
  });

  it('formats with milliseconds', () => {
    expect(formatDuration(1.5)).toBe('00:01.50');
  });

  it('formats large durations', () => {
    expect(formatDuration(3661)).toBe('01:01.00');
  });

  it('pads single digit values', () => {
    expect(formatDuration(9.09)).toBe('00:09.09');
  });
});
