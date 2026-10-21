import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, Card, PageHeader, Stat, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { day, percent, sar } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { Earnings, Payout } from '@/lib/types';

export default async function EarningsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const [e, payouts] = await Promise.all([
    api<Earnings>('/provider/earnings', { query: { providerId: current.id } }),
    api<{ payout: Payout }[]>('/provider/payouts', { query: { providerId: current.id } }),
  ]);
  const free = e.commissionFreeUntil && new Date(e.commissionFreeUntil) > new Date();
  return (
    <>
      <PageHeader title={t('nav.earnings')} subtitle={free ? t('earnings.free', { date: day(e.commissionFreeUntil, locale) }) : t('earnings.rate', { rate: percent(e.commissionRateBps, locale) })} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t('earnings.pendingGross')} icon="wallet" value={sar(e.pending.grossHalalas, locale)} hint={t('earnings.items', { n: e.pending.items })} />
        <Stat label={t('earnings.pendingCommission')} icon="wallet" value={sar(e.pending.commissionHalalas, locale)} />
        <Stat label={t('earnings.pendingNet')} icon="wallet" value={sar(e.pending.netHalalas, locale)} tone="good" hint={t('stats.nextPayout')} />
      </div>
      <Card title={t('earnings.payouts')}>
        <p className="mb-4 text-ink-600">{t('earnings.demoNote')}</p>
        <Table head={[t('earnings.period'), t('earnings.gross'), t('earnings.commission'), t('earnings.net'), t('common.status')]} empty={t('earnings.none')}>
          {payouts.map(({ payout: p }) => (
            <tr key={p.id}>
              <Td>{day(p.periodStart, locale)} – {day(p.periodEnd, locale)}</Td>
              <Td>{sar(p.grossHalalas, locale)}</Td>
              <Td>{sar(p.commissionHalalas, locale)}</Td>
              <Td className="font-semibold">{sar(p.netHalalas, locale)}</Td>
              <Td><Badge status={p.status}>{s(p.status)}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
