import { describe, expect, it } from 'vitest';
import { starDelta } from '../../scripts/lib/signals.mjs';

/**
 * Star deltas power the 「星标涨幅」 board. The two things that must never drift:
 *   1. a window is only reported when a snapshot is actually old enough for it;
 *   2. the divisor is the REAL span between snapshots, not the requested window.
 */
describe('starDelta', () => {
  const points = [
    { date: '2026-11-01', stars: 1000 },
    { date: '2026-11-08', stars: 1200 },
    { date: '2026-11-12', stars: 1400 },
  ];

  it('returns null without history', () => {
    expect(starDelta([], '2026-11-12', 1)).toBeNull();
  });

  it('refuses a window the history cannot cover', () => {
    // Only 11 days of history: a 30-day window has no baseline on/before 2026-10-13.
    expect(starDelta(points, '2026-11-12', 30)).toBeNull();
  });

  it('uses requestedDays for the label and spanDays for the math', () => {
    const week = starDelta(points, '2026-11-12', 7);
    expect(week).not.toBeNull();
    expect(week?.requestedDays).toBe(7);
    // Baseline is 2026-11-01 (newest snapshot at/before 2026-11-05), not 11-08.
    expect(week?.spanDays).toBe(11);
    expect(week?.delta).toBe(400);
    expect(week?.from).toBe('2026-11-01');
    expect(week?.to).toBe('2026-11-12');
  });

  it('reports a same-day-only history as no delta', () => {
    expect(starDelta([{ date: '2026-11-12', stars: 1400 }], '2026-11-12', 1)).toBeNull();
  });

  it('keeps a negative delta instead of clamping it to zero', () => {
    const shrinking = [
      { date: '2026-11-11', stars: 1500 },
      { date: '2026-11-12', stars: 1400 },
    ];
    expect(starDelta(shrinking, '2026-11-12', 1)?.delta).toBe(-100);
  });

  it('never divides by a zero span', () => {
    const duplicate = [
      { date: '2026-11-11', stars: 1000 },
      { date: '2026-11-11', stars: 1000 },
    ];
    expect(starDelta(duplicate, '2026-11-11', 1)).toBeNull();
  });
});
