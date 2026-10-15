'use server';

import { api } from '@/lib/api';
import { bool, list, num, run, str, translated, type ActionState } from './common';

const A = '/[locale]/admin';

export async function providerStatus(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/providers/${str(f, 'id')}/${str(f, 'to')}`, { method: 'POST', body: { reason: str(f, 'reason') } }), A);
}

export async function setCommission(_: ActionState, f: FormData): Promise<ActionState> {
  const pct = str(f, 'percent') ?? '0';
  const bps = Math.round(Number(pct.replace(',', '.')) * 100);
  const freeUntil = str(f, 'freeUntil');
  return run(
    () => api(`/admin/providers/${str(f, 'id')}/commission`, { method: 'PATCH', body: { commissionRateBps: bps, commissionFreeUntil: freeUntil ? new Date(`${freeUntil}T00:00:00+03:00`).toISOString() : null } }),
    A,
  );
}

export async function refundBooking(_: ActionState, f: FormData): Promise<ActionState> {
  const amount = str(f, 'amount') ?? '0';
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(amount);
  const halalas = m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : NaN;
  return run(() => api(`/admin/bookings/${str(f, 'id')}/refund`, { method: 'POST', body: { amountHalalas: halalas, reason: str(f, 'reason') } }), A);
}

export async function resolveDispute(_: ActionState, f: FormData): Promise<ActionState> {
  const amount = str(f, 'amount');
  const m = amount ? /^(\d+)(?:[.,](\d{1,2}))?$/.exec(amount) : null;
  return run(
    () =>
      api(`/admin/bookings/${str(f, 'id')}/resolve`, {
        method: 'POST',
        body: { outcome: str(f, 'outcome'), note: str(f, 'note'), ...(m ? { amountHalalas: Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) } : {}) },
      }),
    A,
  );
}

export async function runPayouts(_: ActionState, f: FormData): Promise<ActionState> {
  const end = str(f, 'periodEnd');
  return run(() => api('/admin/payouts/run', { method: 'POST', body: end ? { periodEnd: new Date(`${end}T00:00:00+03:00`).toISOString() } : {} }), A);
}

export async function approvePayout(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/payouts/${str(f, 'id')}/approve`, { method: 'POST' }), A);
}

export async function reconcile(): Promise<ActionState> {
  return run(() => api('/admin/reconciliation/run', { method: 'POST' }), A);
}

export async function resolveBagCase(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/lost-bag-cases/${str(f, 'id')}/resolve`, { method: 'POST', body: { outcome: str(f, 'outcome'), notes: str(f, 'notes') } }), A);
}

export async function generateTags(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api('/admin/bag-tags', { method: 'POST', body: { count: num(f, 'count') } }), A);
}

export async function checkOverdue(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api('/admin/bags/check-overdue', { method: 'POST', body: { aheadMinutes: num(f, 'aheadMinutes') ?? 0 } }), A);
}

export async function revealLocation(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/lost-alerts/${str(f, 'id')}/location`, { method: 'POST', body: { reason: str(f, 'reason') } }));
}

export async function closeAlert(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/lost-alerts/${str(f, 'id')}`, { method: 'PATCH', body: { status: 'resolved' } }), A);
}

function placeBody(f: FormData) {
  const hoursAlways = str(f, 'hoursAlways');
  return {
    name: translated(f, 'name'),
    description: translated(f, 'description'),
    lat: num(f, 'lat'),
    lng: num(f, 'lng'),
    hours: hoursAlways ? { always: hoursAlways } : undefined,
    languages: list(f, 'languages'),
    priceRange: num(f, 'priceRange'),
    sells: list(f, 'sells'),
    shopProviderId: str(f, 'shopProviderId') ?? null,
  };
}

export async function createPlace(_: ActionState, f: FormData): Promise<ActionState> {
  const { shopProviderId, ...body } = placeBody(f);
  return run(() => api('/admin/places', { method: 'POST', body: { type: str(f, 'type'), city: str(f, 'city'), ...body, ...(shopProviderId ? { shopProviderId } : {}) } }), A);
}

export async function updatePlace(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/places/${str(f, 'id')}`, { method: 'PATCH', body: placeBody(f) }), A);
}

export async function deletePlace(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/places/${str(f, 'id')}`, { method: 'DELETE' }), A);
}

export async function createContent(_: ActionState, f: FormData): Promise<ActionState> {
  return run(
    () => api('/admin/content', { method: 'POST', body: { kind: str(f, 'kind'), title: translated(f, 'title'), body: translated(f, 'body'), link: str(f, 'link'), city: str(f, 'city') } }),
    A,
  );
}

export async function toggleContent(_: ActionState, f: FormData): Promise<ActionState> {
  return run(() => api(`/admin/content/${str(f, 'id')}`, { method: 'PATCH', body: { active: bool(f, 'active') } }), A);
}
