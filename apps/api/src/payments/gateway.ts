import { randomUUID } from 'node:crypto';

/**
 * A licensed payment gateway holds the money; Bidec never keeps pilgrim funds
 * (guide: Payments). The MVP uses this sandbox; HyperPay, Moyasar or Tap plug in
 * behind the same interface once one is chosen (it must support split payments).
 */
export interface PaymentGateway {
  readonly name: string;
  createCheckout(input: { amountHalalas: number; reference: string; method: PaymentMethod }): Promise<{ gatewayRef: string }>;
  refund(input: { gatewayRef: string; amountHalalas: number }): Promise<{ ok: boolean; refundRef: string }>;
}

export const PAYMENT_METHODS = ['card', 'mada', 'apple_pay', 'stc_pay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Sandbox test cards (same idea as real gateway sandboxes). */
export const SANDBOX_CARDS = {
  success: '4111111111111111',
  declined: '4000000000000002',
} as const;

export class SandboxGateway implements PaymentGateway {
  readonly name = 'sandbox';

  async createCheckout(): Promise<{ gatewayRef: string }> {
    return { gatewayRef: `sbx_${randomUUID()}` };
  }

  async refund(): Promise<{ ok: boolean; refundRef: string }> {
    return { ok: true, refundRef: `sbx_rf_${randomUUID()}` };
  }
}
