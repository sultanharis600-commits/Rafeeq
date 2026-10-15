/**
 * Money helpers. All amounts are integer halalas (1 SAR = 100 halalas).
 * Never use floats for money.
 */

export function assertHalalas(value: number, name = 'amount'): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be an integer number of halalas, got ${value}`);
  }
}

/** Parse "12.50" or "12" SAR into halalas without floating-point maths. */
export function sarToHalalas(sar: string): number {
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(sar.trim());
  if (!match) throw new Error(`Invalid SAR amount: ${sar}`);
  const [, sign, whole, frac = ''] = match;
  const value = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return sign ? -value : value;
}

/** Format halalas as "12.50" (no currency symbol; the app adds it per locale). */
export function formatHalalas(halalas: number): string {
  assertHalalas(halalas);
  const sign = halalas < 0 ? '-' : '';
  const abs = Math.abs(halalas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Commission on a gross amount, with the rate in basis points (1500 = 15%).
 * Rounds half up to the nearest halala, so provider net + commission === gross.
 */
export function commissionSplit(grossHalalas: number, rateBps: number): { commission: number; net: number } {
  assertHalalas(grossHalalas, 'gross');
  assertHalalas(rateBps, 'rateBps');
  if (rateBps < 0 || rateBps > 10000) throw new Error(`rateBps out of range: ${rateBps}`);
  const commission = Math.floor((grossHalalas * rateBps + 5000) / 10000);
  return { commission, net: grossHalalas - commission };
}

/** VAT in Saudi Arabia is 15%; amount is VAT-exclusive. */
export const VAT_RATE_BPS = 1500;
export function vatOn(netHalalas: number): number {
  return commissionSplit(netHalalas, VAT_RATE_BPS).commission;
}

/**
 * VAT contained in a VAT-inclusive price (prices shown to pilgrims include VAT).
 * 15% VAT → VAT = total × 15 / 115, rounded half up to the halala.
 */
export function vatIncluded(totalHalalas: number): number {
  assertHalalas(totalHalalas, 'total');
  return Math.floor((totalHalalas * VAT_RATE_BPS + (10000 + VAT_RATE_BPS) / 2) / (10000 + VAT_RATE_BPS));
}
