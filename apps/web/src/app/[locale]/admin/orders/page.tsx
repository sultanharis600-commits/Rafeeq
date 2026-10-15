import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { sar, when } from '@/lib/format';

type Row = { id: string; status: string; shop: string; buyer: string; deliveryType: string; totalHalalas: number; createdAt: string };

export default async function AdminOrders({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const s = await getTranslations('status');
  const page = await api<Page<Row>>('/admin/orders', { query: { status, limit: 100, lang: locale } });
  return (
    <>
      <PageHeader title={t('nav.orders')} />
      <nav className="mb-4 flex flex-wrap gap-2">
        {['', 'paid', 'packed', 'out_for_delivery', 'shipped', 'delivered', 'refunded'].map((f) => (
          <Link key={f} href={`/${locale}/admin/orders${f ? `?status=${f}` : ''}`} className={`min-h-11 rounded-full px-4 py-2 ${(status ?? '') === f ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {f ? s(f) : p('common.all')}
          </Link>
        ))}
      </nav>
      <Table head={[p('orders.date'), t('shop'), p('orders.buyer'), p('orders.delivery'), p('common.total'), p('common.status')]} empty={t('none')}>
        {page.items.map((o) => (
          <tr key={o.id}>
            <Td>{when(o.createdAt, locale)}</Td>
            <Td>{o.shop}</Td>
            <Td>{o.buyer}</Td>
            <Td>{p(`orders.deliveryType.${o.deliveryType}`)}</Td>
            <Td>{sar(o.totalHalalas, locale)}</Td>
            <Td><Badge status={o.status}>{s(o.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
