import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { logout } from '@/app/actions/auth';
import { Icon, Logo, type IconName } from './icons';
import { LanguageSwitch, NavLink } from './nav';

export type NavItem = { href: string; label: string; badge?: number; icon?: IconName };

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
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-khatim print:hidden relative flex flex-col text-white md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <Logo className="size-12 drop-shadow-[0_4px_10px_rgb(0_0_0/0.25)]" />
          <div>
            <p className="font-display text-2xl leading-tight font-bold">{t('name')}</p>
            <p className="text-sm text-gold-300">{title}</p>
          </div>
        </div>
        <div className="sadu-band-thin mx-5 mb-4 rounded-full opacity-90" aria-hidden="true" />
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} badge={n.badge} icon={n.icon}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 pb-5 md:block">
          <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
            <span className="grid size-10 place-items-center rounded-full bg-gold-500 font-semibold text-brand-950">{initials}</span>
            <span className="truncate font-medium">{userName}</span>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sadu-band print:hidden" aria-hidden="true" />
        <header className="print:hidden sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-white/85 px-6 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">{top}</div>
          <div className="flex items-center gap-2">
            <span className="text-ink-600 md:hidden">{userName}</span>
            <LanguageSwitch label={t('switchLanguage')} />
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 font-medium text-clay-700 transition hover:bg-clay-100">
                <Icon name="logout" />
                {t('logout')}
              </button>
            </form>
          </div>
        </header>
        <div className="print:hidden flex items-center gap-2 border-b border-gold-500/30 bg-gold-500/10 px-6 py-2 text-sm text-ink-900">
          <Icon name="info" className="size-4 text-gold-700" />
          {t('demoBanner')}
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
