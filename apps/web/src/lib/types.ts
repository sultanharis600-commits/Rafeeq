/** Shapes returned by the API that the web tools use. */
export type Translated = { en: string; ar?: string; ur?: string; id?: string; ms?: string; tr?: string };

export type Me = {
  id: string;
  name: string;
  phone: string;
  role: 'pilgrim' | 'provider_owner' | 'staff' | 'admin_ops' | 'admin_finance' | 'admin_support';
  language: string;
};

export type Provider = {
  id: string;
  name: Translated;
  description: Translated | null;
  type: 'company' | 'individual';
  kind: 'services' | 'shop';
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  city: 'makkah' | 'madinah';
  crNumber: string | null;
  phone: string | null;
  commissionRateBps: number;
  commissionFreeUntil: string | null;
  ibanLast4: string | null;
  documents: { kind: string; url: string; verified: boolean }[] | null;
  isSample: boolean;
  createdAt: string;
};

export type ServiceRow = {
  id: string;
  providerId: string;
  category: string;
  title: Translated;
  description: Translated | null;
  priceHalalas: number;
  priceModel: string;
  durationMinutes: number | null;
  options: { key: string; title: Translated; priceHalalas: number }[] | null;
  languagesSpoken: string[];
  serviceArea: string;
  cancellationPolicy: string;
  active: boolean;
};

export type Slot = { id: string; serviceId: string; startsAt: string; endsAt: string; capacity: number; booked: number; held: number; blocked: boolean };

export type BookingListItem = {
  id: string;
  status: string;
  title: string;
  category: string;
  startsAt: string | null;
  quantity: number;
  totalHalalas: number;
  acceptBy: string | null;
  assignedStaffId: string | null;
  needs: string[];
  pilgrim: { name: string; language: string };
};

export type BookingDetail = {
  id: string;
  status: string;
  service: { id: string; title: string; category: string; priceModel: string; cancellationPolicy: string };
  provider: { id: string; name: string; phone: string | null };
  slot: { id: string; startsAt: string; endsAt: string } | null;
  quantity: number;
  options: string[];
  totalHalalas: number;
  acceptBy: string | null;
  meetingPoint: string | null;
  pickup: { lat: number; lng: number; label?: string } | null;
  dropoff: { lat: number; lng: number; label?: string } | null;
  needs: string[];
  notes: string | null;
  pilgrim: { name: string; phone: string | null; language: string } | null;
  staff: { id: string; name: string; staffRole: string; vehicle: string | null; phone: string | null } | null;
  liveLocation: { lat: number; lng: number; at: string } | null;
  payments: { id: string; status: string; method: string | null; amountHalalas: number; refundedHalalas: number; createdAt: string }[];
  bags: { id: string; tagCode: string; label: string | null; status: string }[];
  history: { from: string | null; to: string; at: string; reason: string | null }[];
  createdAt: string;
};

export type Staff = { id: string; userId: string; name: string; phone: string; staffRole: string; vehicle: string | null; active: boolean };

export type Product = {
  id: string;
  shopId: string;
  section: string;
  title: Translated;
  description: Translated | null;
  priceHalalas: number;
  stock: number;
  lowStockAlert: number;
  weightGrams: number;
  isFood: boolean;
  shipsAbroad: boolean;
  shipsToCountries: string[];
  active: boolean;
  lowStock?: boolean;
};

export type ShopOrderRow = {
  id: string;
  status: string;
  buyer: string;
  deliveryType: 'hotel' | 'international';
  country: string | null;
  items: number;
  totalHalalas: number;
  giftWrap: boolean;
  trackingNumber: string | null;
  createdAt: string;
};

export type OrderDetail = {
  id: string;
  status: string;
  statusText: string;
  shop: { id: string; name: string; phone: string | null };
  deliveryType: 'hotel' | 'international';
  address: { kind: 'hotel'; placeId: string; room?: string } | { kind: 'international'; line1: string; city: string; country: string; postcode?: string };
  hotel: { name: string; lat: number; lng: number } | null;
  items: { productId: string; title: string; section: string; quantity: number; unitPriceHalalas: number }[];
  subtotalHalalas: number;
  shippingHalalas: number;
  giftWrapHalalas: number;
  totalHalalas: number;
  giftMessage: string | null;
  courier: string | null;
  trackingNumber: string | null;
  buyer: { name: string; phone: string } | null;
  history: { from: string | null; to: string; at: string; reason: string | null }[];
  createdAt: string;
};

export type ProviderBags = {
  inCare: number;
  overdue: number;
  openCases: number;
  bags: { id: string; tagCode: string; label: string | null; status: string; bookingId: string; pilgrim: string; expectedNextScanBy: string | null; openCaseId: string | null }[];
};

export type BagTimeline = {
  id: string;
  tagCode: string;
  label: string | null;
  status: string;
  expectedNextScanBy: string | null;
  scans: { id: string; place: string; status: string; scannedAt: string; syncedLate: boolean; heldBy: string; corrected: boolean; isCorrection: boolean }[];
  cases: { id: string; status: string; reason: string; openedAt: string; resolvedAt: string | null }[];
};

export type Earnings = {
  commissionRateBps: number;
  commissionFreeUntil: string | null;
  pending: { items: number; grossHalalas: number; commissionHalalas: number; netHalalas: number };
  paidOut: { grossHalalas: number; commissionHalalas: number; netHalalas: number };
};

export type Payout = {
  id: string;
  providerId: string;
  periodStart: string;
  periodEnd: string;
  grossHalalas: number;
  commissionHalalas: number;
  netHalalas: number;
  status: string;
  lines: { kind: 'booking' | 'order'; id: string; grossHalalas: number; commissionHalalas: number }[];
};

export type Review = {
  review: { id: string; rating: number; text: string | null; language: string; reply: string | null; createdAt: string };
  author: string;
  serviceTitle: Translated | null;
};

export type Overview = {
  since: string;
  bookings: { count: number; grossHalalas: number; commissionHalalas: number; byCategory: Record<string, number>; awaitingAccept: number; disputes: number };
  shop: { orders: number; salesHalalas: number; commissionHalalas: number };
  refundsHalalas: number;
  providers: { active: number; pending: number };
  safety: { openBagCases: number; openLostAlerts: number };
  topNationalities: { nationality: string; bookings: number }[];
};

export type Place = {
  id: string;
  type: string;
  city: string;
  name: Translated;
  description: Translated | null;
  lat: number;
  lng: number;
  hours: Record<string, string> | null;
  languages: string[];
  priceRange: number | null;
  sells: string[];
  shopProviderId: string | null;
};
