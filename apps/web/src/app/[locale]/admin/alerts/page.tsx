import { getTranslations, setRequestLocale } from 'next-intl/server';
import { closeAlert } from '@/app/actions/admin';
import { ActionButton } from '@/components/forms';
import { Badge, Card, Notice, PageHeader, Stat, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { when } from '@/lib/format';
import { RevealForm } from './reveal-form';

type Alerts = { open: number; last7Days: number; alerts: { id: string; status: string; channel: string; createdAt: string; resolvedAt: string | null; groupId: string | null; ageMinutes: number }[] };

/** Counts and age only; a location is shown only with a reason, and every view is logged. */
export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const s = await getTranslations('status');
  const data = await api<Alerts>('/admin/lost-alerts');
  return (
    <>
      <PageHeader title={t('nav.alerts')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label={t('alerts.open')} value={data.open} tone={data.open ? 'warn' : 'default'} />
        <Stat label={t('alerts.week')} value={data.last7Days} />
      </div>
      <Notice>{t('alerts.privacy')}</Notice>
      <Card className="mt-6">
        <Table head={[t('alerts.raised'), t('alerts.channel'), t('alerts.age'), '', '']} empty={t('none')}>
          {data.alerts.map((a) => (
            <tr key={a.id}>
              <Td>{when(a.createdAt, locale)}</Td>
              <Td>{t(`alerts.channels.${a.channel}`)}</Td>
              <Td>{t('alerts.minutes', { n: a.ageMinutes })} <Badge status={a.status}>{s(a.status)}</Badge></Td>
              <Td><RevealForm id={a.id} /></Td>
              <Td>{a.status !== 'resolved' && <ActionButton action={closeAlert} hidden={{ id: a.id }} variant="secondary">{t('alerts.close')}</ActionButton>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
