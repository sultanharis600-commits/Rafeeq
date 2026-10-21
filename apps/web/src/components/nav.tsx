'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export function NavLink({ href, children, badge, icon }: { href: string; children: ReactNode; badge?: number; icon?: IconName }) {
  const path = usePathname();
  const base = href.split('?')[0];
  const exact = base.split('/').length <= 3; // /ar/provider, /ar/admin
  const active = exact ? path === base : path === base || path.startsWith(`${base}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group flex min-h-12 shrink-0 items-center gap-3 rounded-xl border-s-4 px-3 whitespace-nowrap transition ${
        active ? 'border-gold-500 bg-white/14 font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]' : 'border-transparent text-white/80 hover:bg-white/8 hover:text-white'
      }`}
    >
      {icon && <Icon name={icon} className={`size-5 ${active ? 'text-gold-300' : 'text-white/60 group-hover:text-gold-300'}`} />}
      <span className="flex-1">{children}</span>
      {badge ? <span className="min-w-6 rounded-full bg-gold-500 px-2 text-center text-sm font-bold text-brand-950">{badge}</span> : null}
    </Link>
  );
}

/** Switch between Arabic and English on the same page. */
export function LanguageSwitch({ label }: { label: string }) {
  const path = usePathname();
  const [, locale, ...rest] = path.split('/');
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <Link
      href={`/${other}/${rest.join('/')}`}
      className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-brand-700/25 bg-brand-50 px-3 font-medium text-brand-700 transition hover:border-brand-700"
    >
      <Icon name="globe" />
      {label}
    </Link>
  );
}
