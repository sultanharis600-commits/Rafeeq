import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingTotal, refundFor, slotUnits } from './booking';

test('slot units', () => {
  assert.equal(slotUnits('per_bag', 3), 3);
  assert.equal(slotUnits('per_person', 6), 6);
  assert.equal(slotUnits('per_trip', 1), 1);
  assert.equal(slotUnits('per_hour', 4), 1); // one companion for 4 hours
  assert.throws(() => slotUnits('per_bag', 0));
});

test('booking total', () => {
  assert.equal(bookingTotal('per_trip', 35000, 1, [3000]), 38000);
  assert.equal(bookingTotal('per_bag', 4000, 3), 12000);
  assert.equal(bookingTotal('per_tag', 3000, 2, [10000]), 26000); // deposit per tag
  assert.throws(() => bookingTotal('per_trip', 35000, 2));
  assert.throws(() => bookingTotal('fixed', 10.5, 1));
});

test('refund policies', () => {
  assert.equal(refundFor('flexible', 30, 10001), 10001);
  assert.equal(refundFor('flexible', 5, 10001), 5000);
  assert.equal(refundFor('moderate', 49, 8000), 8000);
  assert.equal(refundFor('moderate', 30, 8000), 4000);
  assert.equal(refundFor('moderate', 10, 8000), 0);
  assert.equal(refundFor('strict', 24 * 8, 8000), 4000);
  assert.equal(refundFor('strict', 24 * 6, 8000), 0);
  assert.equal(refundFor('flexible', -1, 8000), 0);
});
