import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { sar, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { ShopOrderRow } from '@/lib/types';

const FILTERS = ['', 'paid', 'packed', 'out_for_delivery', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default async function Orders({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const page = await api<Page<ShopOrderRow>>('/provider/orders', { query: { shopId: current.id, status, limit: 100 } });
  return (
    <>
      <PageHeader title={t('nav.orders')} />
      <nav className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={`/${locale}/provider/orders${f ? `?status=${f}` : ''}`} className={`min-h-11 rounded-full px-4 py-2 ${(status ?? '') === f ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {f ? s(f) : t('common.all')}
          </Link>
        ))}
      </nav>
      <Table head={[t('orders.date'), t('orders.buyer'), t('orders.delivery'), t('orders.items'), t('common.total'), t('common.status')]} empty={t('common.nothing')}>
        {page.items.map((o) => (
          <tr key={o.id}>
            <Td><Link className="text-brand-700 underline" href={`/${locale}/provider/orders/${o.id}`}>{when(o.createdAt, locale)}</Link></Td>
            <Td>{o.buyer}</Td>
            <Td>
              {t(`orders.deliveryType.${o.deliveryType}`)}
              {o.country ? ` · ${o.country}` : ''}
              {o.giftWrap && <span className="ms-2"><Badge tone="gold">{t('orders.giftWrap')}</Badge></span>}
            </Td>
            <Td>{o.items}</Td>
            <Td>{sar(o.totalHalalas, locale)}</Td>
            <Td><Badge status={o.status}>{s(o.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
