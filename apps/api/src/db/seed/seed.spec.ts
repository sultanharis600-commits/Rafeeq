import { BOOKING_TRANSITIONS, ORDER_TRANSITIONS } from '@rafeeq/shared';
import { sid, statusPath } from './seed.js';

describe('seed helpers', () => {
  it('derives the same UUID from the same key', () => {
    expect(sid('pilgrim-ahmed')).toBe(sid('pilgrim-ahmed'));
    expect(sid('pilgrim-ahmed')).not.toBe(sid('pilgrim-fatima'));
    expect(sid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('walks the booking status machine', () => {
    expect(statusPath(BOOKING_TRANSITIONS, 'pending_payment', 'paid_out')).toEqual([
      'pending_payment',
      'paid',
      'accepted',
      'in_progress',
      'completed',
      'paid_out',
    ]);
    expect(statusPath(BOOKING_TRANSITIONS, 'pending_payment', 'refunded', 'declined')).toEqual([
      'pending_payment',
      'paid',
      'declined',
      'refunded',
    ]);
  });

  it('routes hotel orders through out_for_delivery', () => {
    expect(statusPath(ORDER_TRANSITIONS, 'pending_payment', 'delivered', 'out_for_delivery')).toContain('out_for_delivery');
  });
});
