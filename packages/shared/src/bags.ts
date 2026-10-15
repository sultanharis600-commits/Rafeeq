import type { BagStatus } from './status';

/**
 * Handover points a luggage handler can pick when scanning a bag tag.
 * `status` is the bag's status after the scan; `nextScanWithinMinutes` is how long
 * until the next handover is expected (null = no deadline, e.g. in storage or delivered).
 * A missed deadline opens a lost-bag case.
 */
export const BAG_HANDOVER_POINTS = {
  hotel_lobby: { status: 'in_transit', nextScanWithinMinutes: 45 },
  van: { status: 'in_transit', nextScanWithinMinutes: 180 },
  storage_room: { status: 'stored', nextScanWithinMinutes: null },
  shipping_depot: { status: 'delivered', nextScanWithinMinutes: null },
  airport_counter: { status: 'in_transit', nextScanWithinMinutes: 60 },
  checked_in: { status: 'delivered', nextScanWithinMinutes: null },
  madinah_hotel_lobby: { status: 'delivered', nextScanWithinMinutes: null },
  handed_to_pilgrim: { status: 'delivered', nextScanWithinMinutes: null },
} as const satisfies Record<string, { status: BagStatus; nextScanWithinMinutes: number | null }>;

export type BagHandoverPoint = keyof typeof BAG_HANDOVER_POINTS;
export const BAG_HANDOVER_POINT_KEYS = Object.keys(BAG_HANDOVER_POINTS) as BagHandoverPoint[];

/** Tag codes are random and carry no personal data: "RFQ-" + 6 characters without look-alikes. */
export const TAG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const TAG_CODE = /^RFQ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
