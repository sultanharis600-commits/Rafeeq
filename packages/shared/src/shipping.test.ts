import { test } from 'node:test';
import assert from 'node:assert/strict';
import { internationalShipping, zoneFor } from './shipping';
import { BAG_HANDOVER_POINTS, TAG_CODE } from './bags';

test('shipping by zone and weight', () => {
  assert.equal(zoneFor('id'), 'asia');
  assert.equal(zoneFor('XX'), null);
  assert.deepEqual(internationalShipping('ID', 400), { halalas: 6000, days: 8 }); // 440 g → 1 half kilo
  assert.deepEqual(internationalShipping('ID', 1100), { halalas: 6000 + 2 * 1500, days: 8 }); // 1210 g → 3 half kilos
  assert.equal(internationalShipping('XX', 100), null);
});

test('bag handover rules and tag format', () => {
  assert.equal(BAG_HANDOVER_POINTS.storage_room.status, 'stored');
  assert.equal(BAG_HANDOVER_POINTS.van.nextScanWithinMinutes, 180);
  assert.ok(TAG_CODE.test('RFQ-7Q4K2M'));
  assert.ok(!TAG_CODE.test('RFQ-0O1I2M'));
});
