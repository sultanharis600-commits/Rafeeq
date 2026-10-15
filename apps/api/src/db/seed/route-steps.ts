/**
 * Turn-by-turn steps for the sample walking routes, in all six launch languages.
 * Real routes come from the offline map pack later; these exist so the demo can
 * show large arrows and voice prompts. Translations are drafts for native review.
 */
import type { Language, Translated } from '@rafeeq/shared';
import type { RouteStep } from '../schema.js';

type Pt = { lat: number; lng: number; name: Translated };

const WORDS: Record<Language, { north: string; south: string; east: string; west: string }> = {
  en: { north: 'north', south: 'south', east: 'east', west: 'west' },
  ar: { north: 'شمالاً', south: 'جنوباً', east: 'شرقاً', west: 'غرباً' },
  ur: { north: 'شمال', south: 'جنوب', east: 'مشرق', west: 'مغرب' },
  id: { north: 'utara', south: 'selatan', east: 'timur', west: 'barat' },
  ms: { north: 'utara', south: 'selatan', east: 'timur', west: 'barat' },
  tr: { north: 'kuzeye', south: 'güneye', east: 'doğuya', west: 'batıya' },
};

const START: Record<Language, (dir: string, m: number) => string> = {
  en: (d, m) => `Walk ${d} for ${m} metres.`,
  ar: (d, m) => `امشِ ${d} مسافة ${m} متر.`,
  ur: (d, m) => `${d} کی طرف ${m} میٹر چلیں۔`,
  id: (d, m) => `Berjalan ke arah ${d} sejauh ${m} meter.`,
  ms: (d, m) => `Berjalan ke arah ${d} sejauh ${m} meter.`,
  tr: (d, m) => `${m} metre ${d} yürüyün.`,
};

const TURN: Record<Language, (side: 'left' | 'right', m: number) => string> = {
  en: (s, m) => `Turn ${s} and walk ${m} metres.`,
  ar: (s, m) => `انعطف ${s === 'left' ? 'يساراً' : 'يميناً'} وامشِ ${m} متر.`,
  ur: (s, m) => `${s === 'left' ? 'بائیں' : 'دائیں'} مڑیں اور ${m} میٹر چلیں۔`,
  id: (s, m) => `Belok ${s === 'left' ? 'kiri' : 'kanan'} lalu berjalan ${m} meter.`,
  ms: (s, m) => `Belok ${s === 'left' ? 'kiri' : 'kanan'} dan berjalan ${m} meter.`,
  tr: (s, m) => `${s === 'left' ? 'Sola' : 'Sağa'} dönün ve ${m} metre yürüyün.`,
};

const ARRIVE: Record<Language, (place: string) => string> = {
  en: (p) => `You have arrived at ${p}.`,
  ar: (p) => `وصلت إلى ${p}.`,
  ur: (p) => `آپ ${p} پہنچ گئے ہیں۔`,
  id: (p) => `Anda telah tiba di ${p}.`,
  ms: (p) => `Anda telah tiba di ${p}.`,
  tr: (p) => `${p} konumuna vardınız.`,
};

const LANGS: Language[] = ['en', 'ar', 'ur', 'id', 'ms', 'tr'];

function compass(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  if (Math.abs(dLat) >= Math.abs(dLng)) return dLat >= 0 ? 'north' : 'south';
  return dLng >= 0 ? 'east' : 'west';
}

/** Which way you turn when going from heading a to heading b. */
function side(a: string, b: string): 'left' | 'right' {
  const order = ['north', 'east', 'south', 'west'];
  return (order.indexOf(b) - order.indexOf(a) + 4) % 4 === 1 ? 'right' : 'left';
}

function each(fn: (l: Language) => string): Translated {
  return Object.fromEntries(LANGS.map((l) => [l, fn(l)])) as Translated;
}

export function routeSteps(from: Pt, bend: { lat: number; lng: number }, to: Pt, leg1M: number, leg2M: number): RouteStep[] {
  const steps: RouteStep[] = [];
  const h1 = compass(from, bend);
  const h2 = compass(bend, to);
  if (leg1M > 5) {
    steps.push({ instruction: each((l) => START[l](WORDS[l][h1 as keyof (typeof WORDS)['en']], leg1M)), distanceM: leg1M, direction: 'straight' });
  }
  if (leg2M > 5) {
    if (steps.length === 0) {
      steps.push({ instruction: each((l) => START[l](WORDS[l][h2 as keyof (typeof WORDS)['en']], leg2M)), distanceM: leg2M, direction: 'straight' });
    } else {
      const turn = h1 === h2 ? 'right' : side(h1, h2);
      steps.push({ instruction: each((l) => TURN[l](turn, leg2M)), distanceM: leg2M, direction: turn });
    }
  }
  steps.push({ instruction: each((l) => ARRIVE[l](to.name[l] ?? to.name.en)), distanceM: 0, direction: 'arrive' });
  return steps;
}
