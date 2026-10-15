import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageHeader, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { sar } from '@/lib/format';
import type { Overview } from '@/lib/types';

const RANGES = [1, 7, 30];

export default async function AdminHome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale } = await params;
  const days = Number((await searchParams).days ?? 1);
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const c = await getTranslations('categories');
  const ov = await api<Overview>('/admin/overview', { query: { days } });
  const maxCat = Math.max(1, ...Object.values(ov.bookings.byCategory));
  return (
    <>
      <PageHeader
        title={t('nav.overview')}
        actions={RANGES.map((d) => (
          <Link key={d} href={`/${locale}/admin?days=${d}`} className={`inline-flex min-h-11 items-center rounded-full px-4 ${days === d ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {t('range', { days: d })}
          </Link>
        ))}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('overview.bookings')} value={ov.bookings.count} hint={t('overview.awaiting', { n: ov.bookings.awaitingAccept })} />
        <Stat label={t('overview.gbv')} value={sar(ov.bookings.grossHalalas, locale)} />
        <Stat label={t('overview.commission')} value={sar(ov.bookings.commissionHalalas + ov.shop.commissionHalalas, locale)} tone="good" />
        <Stat label={t('overview.shopSales')} value={sar(ov.shop.salesHalalas, locale)} hint={t('overview.orders', { n: ov.shop.orders })} />
        <Stat label={t('overview.refunds')} value={sar(ov.refundsHalalas, locale)} />
        <Stat label={t('overview.providers')} value={ov.providers.active} hint={t('overview.pending', { n: ov.providers.pending })} tone={ov.providers.pending ? 'warn' : 'default'} />
        <Stat label={t('overview.bagCases')} value={ov.safety.openBagCases} tone={ov.safety.openBagCases ? 'warn' : 'default'} />
        <Stat label={t('overview.lostAlerts')} value={ov.safety.openLostAlerts} tone={ov.safety.openLostAlerts ? 'warn' : 'default'} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={t('overview.byCategory')}>
          <ul className="space-y-2">
            {Object.entries(ov.bookings.byCategory).map(([k, n]) => (
              <li key={k}>
                <div className="flex justify-between"><span>{c(k)}</span><span>{n}</span></div>
                <div className="h-2 rounded-full bg-sand-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(n / maxCat) * 100}%` }} /></div>
              </li>
            ))}
            {Object.keys(ov.bookings.byCategory).length === 0 && <li className="text-ink-600">{t('none')}</li>}
          </ul>
        </Card>
        <Card title={t('overview.nationalities')}>
          <ul className="space-y-2">
            {ov.topNationalities.map((n) => (
              <li key={n.nationality} className="flex justify-between"><span>{n.nationality}</span><span>{n.bookings}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
