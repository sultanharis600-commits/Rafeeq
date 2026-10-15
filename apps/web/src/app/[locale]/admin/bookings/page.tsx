import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { sar, when } from '@/lib/format';

type Row = { id: string; status: string; title: string; provider: string; pilgrim: string; startsAt: string | null; totalHalalas: number; createdAt: string; isSample: boolean };
const FILTERS = ['', 'paid', 'accepted', 'in_progress', 'completed', 'disputed', 'declined', 'cancelled', 'refunded'];

export default async function AdminBookings({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; offset?: string }> }) {
  const { locale } = await params;
  const { status, offset } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const s = await getTranslations('status');
  const page = await api<Page<Row>>('/admin/bookings', { query: { status, limit: 50, offset: Number(offset ?? 0), lang: locale } });
  return (
    <>
      <PageHeader title={t('nav.bookings')} />
      <nav className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={`/${locale}/admin/bookings${f ? `?status=${f}` : ''}`} className={`min-h-11 rounded-full px-4 py-2 ${(status ?? '') === f ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {f ? s(f) : p('common.all')}
          </Link>
        ))}
      </nav>
      <Table head={[p('bookings.service'), t('provider'), p('bookings.pilgrim'), p('bookings.when'), p('common.total'), p('common.status')]} empty={t('none')}>
        {page.items.map((b) => (
          <tr key={b.id}>
            <Td><Link className="text-brand-700 underline" href={`/${locale}/admin/bookings/${b.id}`}>{b.title}</Link></Td>
            <Td>{b.provider}</Td>
            <Td>{b.pilgrim}</Td>
            <Td>{when(b.startsAt, locale)}</Td>
            <Td>{sar(b.totalHalalas, locale)}</Td>
            <Td><Badge status={b.status}>{s(b.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
      {page.hasMore && <Link className="mt-4 inline-block text-brand-700 underline" href={`/${locale}/admin/bookings?${status ? `status=${status}&` : ''}offset=${page.offset + page.limit}`}>{p('common.more')}</Link>}
    </>
  );
}
