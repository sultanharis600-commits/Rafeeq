import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, Notice, PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { when } from '@/lib/format';

type Msg = { id: string; channel: string; to: string | null; toAddress: string | null; template: string; body: string; status: string; createdAt: string };

/** In demo mode every SMS and push lands here instead of being sent (handy during the demo). */
export default async function Outbox({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ channel?: string }> }) {
  const { locale } = await params;
  const { channel } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const page = await api<Page<Msg>>('/admin/outbox', { query: { channel, limit: 100 } });
  return (
    <>
      <PageHeader title={t('nav.outbox')} />
      <Notice>{t('outbox.note')}</Notice>
      <nav className="my-4 flex gap-2">
        {['', 'sms', 'push'].map((c) => (
          <Link key={c} href={`/${locale}/admin/outbox${c ? `?channel=${c}` : ''}`} className={`min-h-11 rounded-full px-4 py-2 ${(channel ?? '') === c ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {c ? t(`outbox.channels.${c}`) : p('common.all')}
          </Link>
        ))}
      </nav>
      <Table head={[p('orders.date'), t('outbox.channel'), t('outbox.to'), t('outbox.message')]} empty={t('none')}>
        {page.items.map((m) => (
          <tr key={m.id}>
            <Td className="whitespace-nowrap">{when(m.createdAt, locale, { timeStyle: 'short', dateStyle: 'short' })}</Td>
            <Td><Badge tone={m.channel === 'sms' ? 'gold' : 'blue'}>{t(`outbox.channels.${m.channel}`)}</Badge></Td>
            <Td>{m.to ?? '—'}{m.toAddress && <p dir="ltr" className="text-sm text-ink-600">{m.toAddress}</p>}</Td>
            <Td><p className="text-sm text-ink-600">{m.template}</p><p dir="auto">{m.body}</p></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
