import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** Small building blocks. Logical properties (ps/pe, start/end) keep every layout RTL-safe. */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-3 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-8 rounded-full bg-brand-700" />
          <span className="h-1.5 w-3 rounded-full bg-gold-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-clay-500" />
        </div>
        <h1 className="font-display text-3xl font-bold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, className = '' }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    // No box: a section is set off by a hairline on top and space, on the white page.
    <section className={`border-t border-sand-300 pt-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-ink-900">
              <span className="size-2 rotate-45 rounded-[2px] bg-gold-500" aria-hidden="true" />
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const STAT_TONE = {
  default: { value: 'text-ink-900', chip: 'bg-linear-to-br from-brand-500 to-brand-900 text-white shadow-[0_6px_14px_-4px_rgb(0_66_37/0.5)]', icon: 'overview' },
  warn: { value: 'text-clay-500', chip: 'bg-linear-to-br from-clay-500 to-clay-700 text-white shadow-[0_6px_14px_-4px_rgb(138_61_31/0.5)]', icon: 'alert' },
  good: { value: 'text-brand-700', chip: 'bg-linear-to-br from-gold-500 to-gold-700 text-white shadow-[0_6px_14px_-4px_rgb(148_114_31/0.5)]', icon: 'trend' },
} satisfies Record<string, { value: string; chip: string; icon: IconName }>;

export function Stat({ label, value, hint, tone = 'default', icon }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'warn' | 'good'; icon?: IconName }) {
  const s = STAT_TONE[tone];
  return (
    // No box: icon, label and figure on the page, separated from neighbours by a rule.
    <div className="flex items-start gap-4 border-s border-sand-300 ps-4 py-1">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${s.chip}`}>
        <Icon name={icon ?? s.icon} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        <p className={`mt-1 text-3xl font-bold tracking-tight ${s.value}`}>{value}</p>
        {hint && <p className="mt-1 text-sm text-ink-600">{hint}</p>}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-brand-100 text-brand-900 ring-brand-700/15',
  gold: 'bg-gold-500/15 text-gold-700 ring-gold-500/30',
  red: 'bg-clay-100 text-clay-700 ring-clay-500/25',
  grey: 'bg-sand-200 text-ink-600 ring-sand-300',
  blue: 'bg-sky-50 text-sky-800 ring-sky-700/15',
};

const DOTS: Record<string, string> = {
  green: 'bg-brand-500',
  gold: 'bg-gold-500',
  red: 'bg-clay-500',
  grey: 'bg-ink-600/50',
  blue: 'bg-sky-600',
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  approved: 'green', completed: 'green', paid_out: 'green', delivered: 'green', succeeded: 'green', resolved: 'green', stored: 'green', found: 'green', sent: 'green',
  pending: 'gold', pending_payment: 'gold', paid: 'gold', initiated: 'gold', calculated: 'gold', packed: 'gold', acknowledged: 'gold', tagged: 'gold',
  accepted: 'blue', in_progress: 'blue', in_transit: 'blue', out_for_delivery: 'blue', shipped: 'blue',
  declined: 'red', cancelled: 'grey', refunded: 'grey', partially_refunded: 'grey', suspended: 'red', rejected: 'red', disputed: 'red', overdue: 'red', lost: 'red', open: 'red', failed: 'red',
};

export function Badge({ children, status, tone }: { children: ReactNode; status?: string; tone?: keyof typeof TONES }) {
  const t = tone ?? (status ? STATUS_TONE[status] : undefined) ?? 'grey';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${TONES[t]}`}>
      <span className={`size-1.5 rounded-full ${DOTS[t]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) && rows.length === 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
      <table className="w-full min-w-[640px] text-start">
        <thead className="border-b border-sand-300 bg-sand-100 text-sm text-ink-600">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-200 [&>tr]:transition-colors [&>tr:hover]:bg-brand-50/60">
          {isEmpty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-12 text-center text-ink-600">
                <span className="mx-auto mb-3 block size-6 rotate-45 rounded-md border-2 border-gold-500/50" aria-hidden="true" />
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

export const buttonCls = {
  primary: 'bg-linear-to-b from-brand-500 to-brand-700 text-white shadow-[0_6px_16px_-6px_rgb(0_108_53/0.6)] hover:from-brand-700 hover:to-brand-900',
  secondary: 'border border-brand-700/30 bg-white text-brand-700 hover:border-brand-700 hover:bg-brand-50',
  danger: 'bg-clay-500 text-white hover:bg-clay-700',
} as const;

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <Link href={href} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition ${buttonCls[variant]}`}>
      {children}
    </Link>
  );
}

export function Notice({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' | 'green' }) {
  const cls =
    tone === 'red'
      ? 'bg-clay-100 text-clay-700 border-clay-500/30'
      : tone === 'green'
        ? 'bg-brand-50 text-brand-900 border-brand-700/20'
        : 'bg-gold-500/10 text-ink-900 border-gold-500/40';
  const icon: IconName = tone === 'red' ? 'alert' : tone === 'green' ? 'check' : 'info';
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border border-s-4 px-4 py-3 ${cls}`}>
      <Icon name={icon} className="mt-0.5 size-5" />
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-600">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'block w-full min-h-12 rounded-xl border border-sand-300 bg-sand-50 px-3.5 text-ink-900 transition placeholder:text-ink-600/60 focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-700/10';
