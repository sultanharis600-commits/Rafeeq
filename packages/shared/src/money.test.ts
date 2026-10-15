import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commissionSplit, formatHalalas, sarToHalalas, vatIncluded, vatOn } from './money';
import { BOOKING_TRANSITIONS, canTransition } from './status';

test('sarToHalalas parses without floating point errors', () => {
  assert.equal(sarToHalalas('0.1'), 10);
  assert.equal(sarToHalalas('19.99'), 1999);
  assert.equal(sarToHalalas('250'), 25000);
  assert.throws(() => sarToHalalas('1.234'));
  assert.throws(() => sarToHalalas('abc'));
});

test('formatHalalas', () => {
  assert.equal(formatHalalas(1999), '19.99');
  assert.equal(formatHalalas(5), '0.05');
  assert.equal(formatHalalas(-150), '-1.50');
});

test('commission split always adds up to gross', () => {
  for (const gross of [0, 1, 99, 15050, 33333, 1234567]) {
    for (const bps of [0, 1000, 1500, 2000]) {
      const { commission, net } = commissionSplit(gross, bps);
      assert.equal(commission + net, gross);
      assert.ok(Number.isInteger(commission));
    }
  }
  assert.deepEqual(commissionSplit(15000, 1500), { commission: 2250, net: 12750 });
  assert.deepEqual(commissionSplit(10, 1500), { commission: 2, net: 8 }); // 1.5 rounds up
});

test('VAT 15%', () => {
  assert.equal(vatOn(10000), 1500);
});

test('booking transitions', () => {
  assert.ok(canTransition(BOOKING_TRANSITIONS, 'pending_payment', 'paid'));
  assert.ok(!canTransition(BOOKING_TRANSITIONS, 'pending_payment', 'completed'));
  assert.ok(!canTransition(BOOKING_TRANSITIONS, 'paid_out', 'refunded'));
});


test('VAT included in a price', () => {
  assert.equal(vatIncluded(11500), 1500);
  assert.equal(vatIncluded(35000), 4565); // 4565.2 → 4565
  assert.equal(vatIncluded(0), 0);
});
