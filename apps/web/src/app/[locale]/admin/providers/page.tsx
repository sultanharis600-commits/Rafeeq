import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { providerStatus, setCommission } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, inputCls, PageHeader } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { day, percent, pick } from '@/lib/format';
import type { Provider } from '@/lib/types';

type Row = Provider & { ownerName: string; ownerPhone: string; serviceCount: number };
const FILTERS = ['pending', 'approved', 'suspended', 'rejected', ''];

export default async function Providers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const status = (await searchParams).status ?? 'pending';
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const s = await getTranslations('status');
  const page = await api<Page<Row>>('/admin/providers', { query: { status: status || undefined, limit: 100 } });
  return (
    <>
      <PageHeader title={t('nav.providers')} subtitle={t('providers.subtitle')} />
      <nav className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={`/${locale}/admin/providers?status=${f}`} className={`min-h-11 rounded-full px-4 py-2 ${status === f ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {f ? s(f) : p('common.all')}
          </Link>
        ))}
      </nav>
      <div className="space-y-4">
        {page.items.length === 0 && <p className="text-ink-600">{t('none')}</p>}
        {page.items.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{pick(r.name, locale)} <Badge status={r.status}>{s(r.status)}</Badge>{r.isSample && <span className="ms-2"><Badge tone="grey">{t('sample')}</Badge></span>}</h2>
                <p className="text-ink-600">
                  {p(`apply.types.${r.type}`)} · {p(`apply.kinds.${r.kind}`)} · {p(`services.city.${r.city}`)} · {t('providers.since', { date: day(r.createdAt, locale) })}
                </p>
                <p>{t('providers.owner')}: {r.ownerName} · <span dir="ltr">{r.ownerPhone}</span></p>
                <p>{p('apply.cr')}: <span dir="ltr">{r.crNumber ?? '—'}</span> · IBAN ••{r.ibanLast4 ?? '—'} · {t('providers.listings', { n: r.serviceCount })}</p>
                <ul className="mt-2 space-y-1">
                  {(r.documents ?? []).map((d, i) => (
                    <li key={i} className="text-sm">
                      {d.kind}:{' '}
                      {d.url.startsWith('upload://') ? (
                        <a className="text-brand-700 underline" target="_blank" rel="noreferrer" href={`/api/uploads/${d.url.slice(9)}`}>{t('providers.openDocument')}</a>
                      ) : (
                        <span dir="ltr" className="font-mono">{d.url}</span>
                      )} {d.verified ? <Badge tone="green">{p('profile.verified')}</Badge> : <Badge tone="gold">{p('profile.unverified')}</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full max-w-sm flex-col gap-3">
                <ActionForm action={providerStatus} hidden={{ id: r.id }} className="flex flex-col gap-2">
                  <input name="reason" placeholder={t('providers.reason')} className={inputCls} />
                  <div className="flex flex-wrap gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button name="to" value="approve" className="min-h-12 rounded-lg bg-brand-700 px-4 text-white">{t('providers.approve')}</button>
                        <button name="to" value="reject" className="min-h-12 rounded-lg border border-red-700 px-4 text-red-700">{t('providers.reject')}</button>
                      </>
                    )}
                    {r.status === 'approved' && <button name="to" value="suspend" className="min-h-12 rounded-lg border border-red-700 px-4 text-red-700">{t('providers.suspend')}</button>}
                    {r.status === 'suspended' && <button name="to" value="reinstate" className="min-h-12 rounded-lg bg-brand-700 px-4 text-white">{t('providers.reinstate')}</button>}
                  </div>
                </ActionForm>
                <ActionForm action={setCommission} hidden={{ id: r.id }} className="flex flex-wrap items-end gap-2" successText={p('common.saved')}>
                  <label className="block">
                    <span className="mb-1 block text-sm">{t('providers.commission')}</span>
                    <input name="percent" inputMode="decimal" dir="ltr" defaultValue={(r.commissionRateBps / 100).toString()} className={`${inputCls} w-24`} aria-describedby={`pct-${r.id}`} />
                    <span id={`pct-${r.id}`} className="text-sm text-ink-600">{percent(r.commissionRateBps, locale)}</span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm">{t('providers.freeUntil')}</span>
                    <input type="date" name="freeUntil" defaultValue={r.commissionFreeUntil?.slice(0, 10) ?? ''} className={inputCls} />
                  </label>
                  <SubmitButton variant="secondary">{p('common.save')}</SubmitButton>
                </ActionForm>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
