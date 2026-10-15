'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, children, badge }: { href: string; children: ReactNode; badge?: number }) {
  const path = usePathname();
  const base = href.split('?')[0];
  const exact = base.split('/').length <= 3; // /ar/provider, /ar/admin
  const active = exact ? path === base : path === base || path.startsWith(`${base}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-lg px-3 whitespace-nowrap ${active ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'}`}
    >
      <span>{children}</span>
      {badge ? <span className="rounded-full bg-gold-500 px-2 text-sm text-ink-900">{badge}</span> : null}
    </Link>
  );
}

/** Switch between Arabic and English on the same page. */
export function LanguageSwitch({ label }: { label: string }) {
  const path = usePathname();
  const [, locale, ...rest] = path.split('/');
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <Link href={`/${other}/${rest.join('/')}`} className="min-h-12 rounded-lg border border-brand-700 px-3 py-3 text-brand-700 hover:bg-brand-100">
      {label}
    </Link>
  );
}
