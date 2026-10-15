'use server';

import { api, uploadFile } from '@/lib/api';
import { bool, list, num, run, str, translated, type ActionState } from './common';

const P = '/[locale]/provider';

/** Read "350.00" SAR from a form field into integer halalas. */
function halalas(f: FormData, k: string): number | undefined {
  const v = str(f, k);
  if (v === undefined) return undefined;
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(v);
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : NaN;
}

// ───────────── onboarding and profile ─────────────

export async function applyProvider(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    // Documents are uploaded first (stored encrypted), then referenced in the application.
    const docs: { kind: string; url: string }[] = [];
    const idDoc = f.get('idDocument');
    const licence = f.get('licence');
    if (idDoc instanceof File && idDoc.size > 0) docs.push({ kind: str(f, 'type') === 'company' ? 'commercial_registration' : 'national_id', url: await uploadFile(idDoc) });
    if (licence instanceof File && licence.size > 0) docs.push({ kind: 'licence', url: await uploadFile(licence) });
    return api('/providers', {
      method: 'POST',
      body: {
        type: str(f, 'type'),
        kind: str(f, 'kind'),
        name: translated(f, 'name'),
        description: translated(f, 'description'),
        crNumber: str(f, 'crNumber'),
        city: str(f, 'city'),
        phone: str(f, 'phone'),
        iban: str(f, 'iban')?.replace(/\s+/g, '').toUpperCase(),
        documents: docs,
      },
    });
  }, P);
}

export async function updateProfile(_: ActionState, f: FormData): Promise<ActionState> {
  const iban = str(f, 'iban')?.replace(/\s+/g, '').toUpperCase();
  return run(
    () => api(`/providers/${str(f, 'providerId')}`, { method: 'PATCH', body: { name: translated(f, 'name'), description: translated(f, 'description'), phone: str(f, 'phone'), ...(iban ? { iban } : {}) } }),
    P,
  );
}

export async function addStaff(_: ActionState, f: FormData): Promise<ActionState> {
  return run(
    () => api(`/providers/${str(f, 'providerId')}/staff`, { method: 'POST', body: { phone: str(f, 'phone'), name: str(f, 'name'), staffRole: str(f, 'staffRole'), vehicle: str(f, 'vehicle') } }),
    P,
  );
}

export async function removeStaff(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/providers/${str(f, 'providerId')}/staff/${str(f, 'staffId')}`, { method: 'DELETE' }), P);
}

// ───────────── bookings ─────────────

export async function acceptBooking(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/bookings/${str(f, 'id')}/accept`, { method: 'POST' }), P);
}

export async function declineBooking(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/bookings/${str(f, 'id')}/decline`, { method: 'POST', body: { reason: str(f, 'reason') ?? 'Not available' } }), P);
}

export async function cancelBooking(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/bookings/${str(f, 'id')}/cancel`, { method: 'POST', body: { reason: str(f, 'reason') ?? 'Provider cancelled' } }), P);
}

export async function assignStaff(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/bookings/${str(f, 'id')}/assign`, { method: 'POST', body: { staffId: str(f, 'staffId') } }), P);
}

export async function startBooking(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/staff/bookings/${str(f, 'id')}/start`, { method: 'POST' }), P);
}

export async function completeBooking(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/staff/bookings/${str(f, 'id')}/complete`, { method: 'POST' }), P);
}

// ───────────── services and slots ─────────────

function serviceBody(f: FormData) {
  const optionKeys = list(f, 'option.key');
  const optionTitles = list(f, 'option.title');
  const optionPrices = f.getAll('option.price').map((v) => String(v));
  return {
    title: translated(f, 'title'),
    description: translated(f, 'description'),
    priceHalalas: halalas(f, 'price'),
    priceModel: str(f, 'priceModel'),
    durationMinutes: num(f, 'durationMinutes'),
    languagesSpoken: list(f, 'languagesSpoken'),
    serviceArea: str(f, 'serviceArea'),
    cancellationPolicy: str(f, 'cancellationPolicy'),
    options: optionKeys
      .map((key, i) => ({ key, title: { en: optionTitles[i] ?? key }, priceHalalas: Math.round(Number(optionPrices[i] ?? '0') * 100) }))
      .filter((o) => o.key),
  };
}

export async function createService(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api('/provider/services', { method: 'POST', body: { providerId: str(f, 'providerId'), category: str(f, 'category'), ...serviceBody(f) } }), P);
}

export async function updateService(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/services/${str(f, 'id')}`, { method: 'PATCH', body: { ...serviceBody(f), active: bool(f, 'active') } }), P);
}

export async function toggleService(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/services/${str(f, 'id')}`, { method: 'PATCH', body: { active: str(f, 'active') === 'true' } }), P);
}

export async function generateSlots(_: ActionState, f: FormData): Promise<ActionState> {
  return run(
    () =>
      api(`/provider/services/${str(f, 'id')}/slots`, {
        method: 'POST',
        body: { fromDate: str(f, 'fromDate'), days: num(f, 'days'), hours: list(f, 'hours').map(Number), capacity: num(f, 'capacity') },
      }),
    P,
  );
}

export async function updateSlot(_: ActionState, f: FormData): Promise<ActionState> {
  const body: Record<string, unknown> = {};
  if (str(f, 'capacity') !== undefined) body.capacity = num(f, 'capacity');
  if (str(f, 'blocked') !== undefined) body.blocked = str(f, 'blocked') === 'true';
  return run(() => api(`/provider/slots/${str(f, 'id')}`, { method: 'PATCH', body }), P);
}

// ───────────── shop ─────────────

function productBody(f: FormData) {
  return {
    section: str(f, 'section'),
    title: translated(f, 'title'),
    description: translated(f, 'description'),
    priceHalalas: halalas(f, 'price'),
    stock: num(f, 'stock'),
    lowStockAlert: num(f, 'lowStockAlert'),
    weightGrams: num(f, 'weightGrams'),
    isFood: bool(f, 'isFood'),
    shipsAbroad: bool(f, 'shipsAbroad'),
    shipsToCountries: (str(f, 'shipsToCountries') ?? '')
      .split(/[\s,]+/)
      .map((c) => c.toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
  };
}

export async function createProduct(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api('/provider/products', { method: 'POST', body: { shopId: str(f, 'shopId'), ...productBody(f) } }), P);
}

export async function updateProduct(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/products/${str(f, 'id')}`, { method: 'PATCH', body: { ...productBody(f), active: bool(f, 'active') } }), P);
}

export async function restock(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/products/${str(f, 'id')}`, { method: 'PATCH', body: { stock: num(f, 'stock') } }), P);
}

export async function orderStep(_: ActionState, f: FormData): Promise<ActionState> {
  const id = str(f, 'id');
  const step = str(f, 'step');
  if (step === 'ship') {
    return run(() => api(`/provider/orders/${id}/ship`, { method: 'POST', body: { courier: str(f, 'courier'), trackingNumber: str(f, 'trackingNumber') } }), P);
  }
  if (step === 'cancel') return run(() => api(`/provider/orders/${id}/cancel`, { method: 'POST', body: { reason: str(f, 'reason') ?? 'Cannot fulfil' } }), P);
  return run(() => api(`/provider/orders/${id}/${step}`, { method: 'POST' }), P);
}

// ───────────── reviews ─────────────

export async function replyReview(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/provider/reviews/${str(f, 'id')}/reply`, { method: 'POST', body: { text: str(f, 'text') } }), P);
}
