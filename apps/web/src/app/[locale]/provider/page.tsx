import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { acceptBooking } from '@/app/actions/provider';
import { ActionButton } from '@/components/forms';
import { ButtonLink, Card, Notice, PageHeader, Stat, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { sar, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { BookingListItem, Earnings, Product, ProviderBags, ShopOrderRow } from '@/lib/types';
import { DeclineForm } from './bookings/decline-form';

export default async function ProviderHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  const t = await getTranslations('Provider');

  if (!current) {
    return (
      <>
        <PageHeader title={t('welcome.title')} subtitle={t('welcome.subtitle')} />
        <ButtonLink href={`/${locale}/provider/apply`}>{t('welcome.apply')}</ButtonLink>
      </>
    );
  }

  const earnings = await api<Earnings>('/provider/earnings', { query: { providerId: current.id } });
  const statusNotice =
    current.status === 'pending' ? (
      <Notice>{t('pendingNotice')}</Notice>
    ) : current.status === 'suspended' ? (
      <Notice tone="red">{t('suspendedNotice')}</Notice>
    ) : current.status === 'rejected' ? (
      <Notice tone="red">{t('rejectedNotice')}</Notice>
    ) : null;

  if (current.kind === 'shop') {
    const [toPack, low] = await Promise.all([
      api<Page<ShopOrderRow>>('/provider/orders', { query: { shopId: current.id, status: 'paid', limit: 20 } }),
      api<Product[]>('/provider/products/low-stock', { query: { shopId: current.id } }),
    ]);
    return (
      <>
        <PageHeader title={t('nav.overview')} />
        <div className="space-y-6">
          {statusNotice}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t('stats.toPack')} icon="package" value={toPack.items.length} tone={toPack.items.length ? 'warn' : 'default'} />
            <Stat label={t('stats.lowStock')} icon="gift" value={low.length} tone={low.length ? 'warn' : 'default'} />
            <Stat label={t('stats.pendingEarnings')} icon="wallet" value={sar(earnings.pending.netHalalas, locale)} hint={t('stats.nextPayout')} tone="good" />
          </div>
          <Card title={t('stats.toPack')}>
            <Table head={[t('orders.buyer'), t('orders.delivery'), t('orders.items'), t('common.total'), '']} empty={t('common.nothing')}>
              {toPack.items.map((o) => (
                <tr key={o.id}>
                  <Td>{o.buyer}</Td>
                  <Td>{t(`orders.deliveryType.${o.deliveryType}`)}{o.country ? ` · ${o.country}` : ''}</Td>
                  <Td>{o.items}</Td>
                  <Td>{sar(o.totalHalalas, locale)}</Td>
                  <Td>
                    <Link className="text-brand-700 underline" href={`/${locale}/provider/orders/${o.id}`}>{t('common.open')}</Link>
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </>
    );
  }

  const [awaiting, active, bags] = await Promise.all([
    api<Page<BookingListItem>>('/provider/bookings', { query: { providerId: current.id, status: 'paid', limit: 50, lang: locale } }),
    api<Page<BookingListItem>>('/provider/bookings', { query: { providerId: current.id, status: 'in_progress', limit: 50, lang: locale } }),
    api<ProviderBags>('/provider/bags', { query: { providerId: current.id } }),
  ]);

  return (
    <>
      <PageHeader title={t('nav.overview')} />
      <div className="space-y-6">
        {statusNotice}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('stats.awaiting')} icon="clock" value={awaiting.items.length} hint={t('stats.awaitingHint')} tone={awaiting.items.length ? 'warn' : 'default'} />
          <Stat label={t('stats.inProgress')} icon="calendar" value={active.items.length} />
          <Stat label={t('stats.overdueBags')} icon="luggage" value={bags.overdue} tone={bags.overdue ? 'warn' : 'default'} hint={t('stats.openCases', { n: bags.openCases })} />
          <Stat label={t('stats.pendingEarnings')} icon="wallet" value={sar(earnings.pending.netHalalas, locale)} hint={t('stats.nextPayout')} tone="good" />
        </div>
        <Card title={t('stats.awaiting')}>
          <Table head={[t('bookings.service'), t('bookings.when'), t('bookings.pilgrim'), t('bookings.acceptBy'), '']} empty={t('common.nothing')}>
            {awaiting.items.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link className="text-brand-700 underline" href={`/${locale}/provider/bookings/${b.id}`}>{b.title}</Link>
                  {b.needs.length > 0 && <p className="text-sm text-ink-600">{b.needs.map((n) => t(`needs.${n}`)).join(' · ')}</p>}
                </Td>
                <Td>{when(b.startsAt, locale)}</Td>
                <Td>{b.pilgrim.name}</Td>
                <Td>{when(b.acceptBy, locale, { timeStyle: 'short' })}</Td>
                <Td className="flex flex-wrap gap-2">
                  <ActionButton action={acceptBooking} hidden={{ id: b.id }}>{t('bookings.accept')}</ActionButton>
                  <DeclineForm id={b.id} />
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
