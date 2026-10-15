import { weekStart } from './payouts.service.js';

describe('weekStart', () => {
  it('is Monday 00:00 Saudi time (Sunday 21:00 UTC)', () => {
    // Tuesday 13 Oct 2026, 16:00 UTC = 19:00 Saudi
    expect(weekStart(new Date('2026-10-13T16:00:00Z')).toISOString()).toBe('2026-10-11T21:00:00.000Z');
    // Sunday 22:30 UTC is already Monday 01:30 in Saudi
    expect(weekStart(new Date('2026-10-18T22:30:00Z')).toISOString()).toBe('2026-10-18T21:00:00.000Z');
  });
});
