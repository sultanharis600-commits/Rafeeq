import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, PageHeader, Stat, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { isPast, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { ProviderBags } from '@/lib/types';

export default async function Bags({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const data = await api<ProviderBags>('/provider/bags', { query: { providerId: current.id } });
  return (
    <>
      <PageHeader title={t('nav.bags')} subtitle={t('bags.subtitle')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t('bags.inCare')} icon="luggage" value={data.inCare} />
        <Stat label={t('bags.overdue')} icon="luggage" value={data.overdue} tone={data.overdue ? 'warn' : 'default'} />
        <Stat label={t('bags.openCases')} icon="luggage" value={data.openCases} tone={data.openCases ? 'warn' : 'default'} />
      </div>
      <Table head={[t('bags.tag'), t('bags.label'), t('bookings.pilgrim'), t('bags.nextScan'), t('common.status')]} empty={t('bags.none')}>
        {data.bags.map((b) => {
          const late = isPast(b.expectedNextScanBy);
          return (
            <tr key={b.id} className={b.openCaseId ? 'bg-clay-100' : ''}>
              <Td><Link className="font-mono text-brand-700 underline" href={`/${locale}/provider/bags/${b.id}`}>{b.tagCode}</Link></Td>
              <Td>{b.label ?? '—'}</Td>
              <Td>{b.pilgrim}</Td>
              <Td className={late ? 'font-semibold text-clay-700' : ''}>{when(b.expectedNextScanBy, locale, { timeStyle: 'short', dateStyle: 'short' })}</Td>
              <Td>
                <Badge status={b.status}>{s(b.status)}</Badge>
                {b.openCaseId && <span className="ms-2"><Badge tone="red">{t('bags.caseOpen')}</Badge></span>}
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
