import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { logout } from '@/app/actions/auth';
import { LanguageSwitch, NavLink } from './nav';

export type NavItem = { href: string; label: string; badge?: number };

/** Sidebar layout for the provider dashboard and the admin panel. */
export async function Shell({
  locale,
  title,
  userName,
  nav,
  top,
  children,
}: {
  locale: string;
  title: string;
  userName: string;
  nav: NavItem[];
  top?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations('App');
  const signOut = logout.bind(null, locale);
  return (
    <div className="min-h-screen md:flex">
      <aside className="print:hidden border-b border-sand-300 bg-brand-900 text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-e">
        <div className="px-5 py-5">
          <p className="text-2xl font-semibold">{t('name')}</p>
          <p className="text-sm text-brand-100">{title}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} badge={n.badge}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-sand-300 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">{top}</div>
          <div className="flex items-center gap-3">
            <span className="text-ink-600">{userName}</span>
            <LanguageSwitch label={t('switchLanguage')} />
            <form action={signOut}>
              <button type="submit" className="min-h-12 rounded-lg px-3 text-brand-700 hover:bg-brand-100">
                {t('logout')}
              </button>
            </form>
          </div>
        </header>
        <div className="print:hidden border-b border-gold-500/30 bg-gold-500/10 px-6 py-2 text-sm">{t('demoBanner')}</div>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
