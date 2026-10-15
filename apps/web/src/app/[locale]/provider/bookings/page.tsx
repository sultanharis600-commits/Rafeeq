import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { sar, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { BookingListItem } from '@/lib/types';

const FILTERS = ['', 'paid', 'accepted', 'in_progress', 'completed', 'paid_out', 'disputed', 'declined', 'cancelled', 'refunded'];

export default async function Bookings({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; offset?: string }> }) {
  const { locale } = await params;
  const { status, offset } = await searchParams;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const page = await api<Page<BookingListItem>>('/provider/bookings', { query: { providerId: current.id, status, limit: 50, offset: Number(offset ?? 0), lang: locale } });

  return (
    <>
      <PageHeader title={t('nav.bookings')} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t('common.filter')}>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/${locale}/provider/bookings${f ? `?status=${f}` : ''}`}
            aria-current={(status ?? '') === f ? 'true' : undefined}
            className={`min-h-11 rounded-full px-4 py-2 ${(status ?? '') === f ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}
          >
            {f ? s(f) : t('common.all')}
          </Link>
        ))}
      </nav>
      <Table head={[t('bookings.service'), t('bookings.when'), t('bookings.pilgrim'), t('bookings.quantity'), t('common.total'), t('common.status')]} empty={t('common.nothing')}>
        {page.items.map((b) => (
          <tr key={b.id}>
            <Td>
              <Link className="text-brand-700 underline" href={`/${locale}/provider/bookings/${b.id}`}>{b.title}</Link>
            </Td>
            <Td>{when(b.startsAt, locale)}</Td>
            <Td>
              {b.pilgrim.name}
              <span className="ms-2 text-sm text-ink-600">{b.pilgrim.language.toUpperCase()}</span>
            </Td>
            <Td>{b.quantity}</Td>
            <Td>{sar(b.totalHalalas, locale)}</Td>
            <Td>
              <Badge status={b.status}>{s(b.status)}</Badge>
            </Td>
          </tr>
        ))}
      </Table>
      {page.hasMore && (
        <Link className="mt-4 inline-block text-brand-700 underline" href={`/${locale}/provider/bookings?${status ? `status=${status}&` : ''}offset=${page.offset + page.limit}`}>
          {t('common.more')}
        </Link>
      )}
    </>
  );
}
