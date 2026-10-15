import Link from 'next/link';
import type { ReactNode } from 'react';

/** Small building blocks. Logical properties (ps/pe, start/end) keep every layout RTL-safe. */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, className = '' }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-sand-300 bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-ink-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'warn' | 'good' }) {
  const color = tone === 'warn' ? 'text-red-700' : tone === 'good' ? 'text-brand-700' : 'text-ink-900';
  return (
    <div className="rounded-xl border border-sand-300 bg-white p-4">
      <p className="text-sm text-ink-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-600">{hint}</p>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-brand-100 text-brand-900',
  gold: 'bg-gold-500/20 text-ink-900',
  red: 'bg-red-100 text-red-800',
  grey: 'bg-sand-300/60 text-ink-600',
  blue: 'bg-sky-100 text-sky-900',
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  approved: 'green', completed: 'green', paid_out: 'green', delivered: 'green', succeeded: 'green', resolved: 'green', stored: 'green', found: 'green', sent: 'green',
  pending: 'gold', pending_payment: 'gold', paid: 'gold', initiated: 'gold', calculated: 'gold', packed: 'gold', acknowledged: 'gold', tagged: 'gold',
  accepted: 'blue', in_progress: 'blue', in_transit: 'blue', out_for_delivery: 'blue', shipped: 'blue',
  declined: 'red', cancelled: 'grey', refunded: 'grey', partially_refunded: 'grey', suspended: 'red', rejected: 'red', disputed: 'red', overdue: 'red', lost: 'red', open: 'red', failed: 'red',
};

export function Badge({ children, status, tone }: { children: ReactNode; status?: string; tone?: keyof typeof TONES }) {
  const t = tone ?? (status ? STATUS_TONE[status] : undefined) ?? 'grey';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${TONES[t]}`}>{children}</span>;
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) && rows.length === 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-sand-300 bg-white">
      <table className="w-full min-w-[640px] text-start">
        <thead className="bg-sand-100 text-sm text-ink-600">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-300">
          {isEmpty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-8 text-center text-ink-600">
                {empty}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const cls =
    variant === 'primary'
      ? 'bg-brand-700 text-white hover:bg-brand-900'
      : 'border border-brand-700 text-brand-700 hover:bg-brand-100';
  return (
    <Link href={href} className={`inline-flex min-h-12 items-center justify-center rounded-lg px-4 font-medium ${cls}`}>
      {children}
    </Link>
  );
}

export function Notice({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' | 'green' }) {
  const cls = tone === 'red' ? 'bg-red-50 text-red-900 border-red-200' : tone === 'green' ? 'bg-brand-100 text-brand-900 border-brand-100' : 'bg-gold-500/10 text-ink-900 border-gold-500/30';
  return <div role="status" className={`rounded-lg border px-4 py-3 ${cls}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-600">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'block w-full min-h-12 rounded-lg border border-sand-300 bg-white px-3 text-ink-900 focus:border-brand-500 focus:outline-none';
