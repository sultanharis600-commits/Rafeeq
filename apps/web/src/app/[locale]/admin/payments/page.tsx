import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { sar, when } from '@/lib/format';

type Payment = { id: string; bookingId: string | null; orderId: string | null; gateway: string; method: string | null; amountHalalas: number; refundedHalalas: number; status: string; createdAt: string };

export default async function Payments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const s = await getTranslations('status');
  const rows = await api<Payment[]>('/admin/payments', { query: { limit: 100 } });
  return (
    <>
      <PageHeader title={t('nav.payments')} subtitle={t('payments.subtitle')} />
      <Table head={[p('orders.date'), t('payments.for'), t('payments.method'), t('payments.amount'), t('payments.refunded'), p('common.status')]} empty={t('none')}>
        {rows.map((x) => (
          <tr key={x.id}>
            <Td>{when(x.createdAt, locale)}</Td>
            <Td>{x.bookingId ? t('payments.booking') : t('payments.order')} <span className="font-mono text-sm">{(x.bookingId ?? x.orderId ?? '').slice(0, 8)}</span></Td>
            <Td>{x.method ? p(`method.${x.method}`) : '—'} · {x.gateway}</Td>
            <Td>{sar(x.amountHalalas, locale)}</Td>
            <Td>{x.refundedHalalas ? sar(x.refundedHalalas, locale) : '—'}</Td>
            <Td><Badge status={x.status}>{s(x.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
