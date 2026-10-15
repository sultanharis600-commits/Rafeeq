import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { checkOverdue, generateTags, resolveBagCase } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, ButtonLink, Card, Field, inputCls, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

type CaseRow = { c: { id: string; status: string; reason: string; notes: string | null; openedAt: string; resolvedAt: string | null }; tagCode: string; label: string | null; bagStatus: string; owner: string | null; bookingId: string | null };

export default async function AdminBags({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const status = (await searchParams).status ?? 'open';
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const b = await getTranslations('Bags');
  const s = await getTranslations('status');
  const cases = await api<CaseRow[]>('/admin/lost-bag-cases', { query: { status } });
  return (
    <>
      <PageHeader title={t('nav.bags')} actions={<ButtonLink href={`/${locale}/admin/bags/tags`} variant="secondary">{t('bags.printTags')}</ButtonLink>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <nav className="flex gap-2">
            {['open', 'resolved'].map((f) => (
              <Link key={f} href={`/${locale}/admin/bags?status=${f}`} className={`min-h-11 rounded-full px-4 py-2 ${status === f ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>{s(f)}</Link>
            ))}
          </nav>
          {cases.length === 0 && <p className="text-ink-600">{t('none')}</p>}
          {cases.map((r) => (
            <Card key={r.c.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold"><span className="font-mono">{r.tagCode}</span> · {r.label ?? '—'} <Badge status={r.bagStatus}>{s(r.bagStatus)}</Badge></p>
                  <p className="text-ink-600">{r.owner ?? '—'} · {b(`reason.${r.c.reason}`)} · {when(r.c.openedAt, locale)}</p>
                  {r.c.notes && <p className="mt-1 whitespace-pre-line">{r.c.notes}</p>}
                </div>
                <Badge status={r.c.status}>{s(r.c.status)}</Badge>
              </div>
              {r.c.status === 'open' && (
                <ActionForm action={resolveBagCase} hidden={{ id: r.c.id }} className="mt-3 flex flex-wrap gap-2">
                  <select name="outcome" className={`${inputCls} w-auto`} aria-label={t('bags.outcome')}>
                    <option value="found">{t('bags.found')}</option>
                    <option value="lost">{t('bags.lost')}</option>
                  </select>
                  <input name="notes" required placeholder={t('bags.notes')} className={`${inputCls} flex-1`} />
                  <SubmitButton>{t('bags.resolve')}</SubmitButton>
                </ActionForm>
              )}
            </Card>
          ))}
        </div>
        <div className="space-y-6">
        <Card title={t('bags.checkOverdue')}>
          <p className="mb-3 text-ink-600">{t('bags.checkOverdueHint')}</p>
          <ActionForm action={checkOverdue} successText={t('bags.checked')}>
            <Field label={t('bags.ahead')}>
              <select name="aheadMinutes" defaultValue="0" className={inputCls}>
                <option value="0">{t('bags.aheadNow')}</option>
                <option value="60">{t('bags.ahead60')}</option>
                <option value="240">{t('bags.ahead240')}</option>
              </select>
            </Field>
            <SubmitButton>{t('bags.checkButton')}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t('bags.generate')}>
          <p className="mb-3 text-ink-600">{t('bags.generateHint')}</p>
          <ActionForm action={generateTags} successText={t('bags.generated')}>
            <Field label={t('bags.count')}><input name="count" type="number" min={1} max={500} defaultValue={24} className={inputCls} /></Field>
            <SubmitButton>{t('bags.generateButton')}</SubmitButton>
          </ActionForm>
        </Card>
        </div>
      </div>
    </>
  );
}
