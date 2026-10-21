import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { chooseProvider } from '@/app/actions/auth';
import { Shell, type NavItem } from '@/components/shell';
import { Badge } from '@/components/ui';
import { pick } from '@/lib/format';
import { requireProvider } from '@/lib/session';

export default async function ProviderLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { me, providers, current } = await requireProvider(locale);
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const base = `/${locale}/provider`;

  const nav: NavItem[] = current
    ? [
        { href: base, label: t('nav.overview'), icon: 'overview' as const },
        ...(current.kind === 'services'
          ? [
              { href: `${base}/bookings`, label: t('nav.bookings'), icon: 'calendar' as const },
              { href: `${base}/services`, label: t('nav.services'), icon: 'layers' as const },
              { href: `${base}/bags`, label: t('nav.bags'), icon: 'luggage' as const },
            ]
          : [
              { href: `${base}/orders`, label: t('nav.orders'), icon: 'package' as const },
              { href: `${base}/products`, label: t('nav.products'), icon: 'gift' as const },
            ]),
        { href: `${base}/staff`, label: t('nav.staff'), icon: 'users' as const },
        { href: `${base}/earnings`, label: t('nav.earnings'), icon: 'wallet' as const },
        { href: `${base}/reviews`, label: t('nav.reviews'), icon: 'star' as const },
        { href: `${base}/profile`, label: t('nav.profile'), icon: 'store' as const },
        { href: `${base}/apply`, label: t('nav.addBusiness'), icon: 'plus' as const },
      ]
    : [{ href: `${base}/apply`, label: t('nav.apply'), icon: 'plus' as const }];

  const switcher =
    providers.length > 1 ? (
      <div className="flex flex-wrap items-center gap-2">
        {providers.map((p) => (
          <form key={p.id} action={chooseProvider.bind(null, locale, p.id)}>
            <button
              type="submit"
              aria-pressed={p.id === current?.id}
              className={`min-h-12 rounded-xl px-4 font-medium transition ${p.id === current?.id ? 'bg-brand-700 text-white shadow-soft' : 'border border-sand-300 bg-white hover:border-brand-700 hover:bg-brand-50'}`}
            >
              {pick(p.name, locale)}
            </button>
          </form>
        ))}
      </div>
    ) : current ? (
      <div className="flex items-center gap-2">
        <span className="font-semibold">{pick(current.name, locale)}</span>
        <Badge status={current.status}>{s(current.status)}</Badge>
      </div>
    ) : null;

  return (
    <Shell locale={locale} title={t('title')} userName={me.name} nav={nav} top={switcher}>
      {children}
    </Shell>
  );
}
