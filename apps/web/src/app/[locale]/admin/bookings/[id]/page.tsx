import { getTranslations, setRequestLocale } from 'next-intl/server';
import { refundBooking, resolveDispute } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Field, inputCls, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { fromHalalas, sar, when } from '@/lib/format';
import type { BookingDetail } from '@/lib/types';

export default async function AdminBooking({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const s = await getTranslations('status');
  const b = await api<BookingDetail>(`/bookings/${id}`, { query: { lang: locale } });
  const captured = b.payments.reduce((sum, x) => sum + (['succeeded', 'partially_refunded', 'refunded'].includes(x.status) ? x.amountHalalas - x.refundedHalalas : 0), 0);
  return (
    <>
      <PageHeader title={b.service.title} subtitle={`${b.provider.name} · ${when(b.slot?.startsAt, locale)}`} actions={<Badge status={b.status}>{s(b.status)}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={p('bookings.details')} className="lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-ink-600">{p('bookings.pilgrim')}</dt><dd>{b.pilgrim?.name} · <span dir="ltr">{b.pilgrim?.phone ?? '—'}</span></dd></div>
            <div><dt className="text-sm text-ink-600">{p('common.total')}</dt><dd>{sar(b.totalHalalas, locale)}</dd></div>
            <div><dt className="text-sm text-ink-600">{t('captured')}</dt><dd>{sar(captured, locale)}</dd></div>
            <div><dt className="text-sm text-ink-600">{p('bookings.assigned')}</dt><dd>{b.staff?.name ?? '—'}</dd></div>
          </dl>
          <h3 className="mt-6 mb-2 font-semibold">{p('bookings.history')}</h3>
          <ol className="space-y-2">
            {b.history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <span className="text-ink-600">{when(h.at, locale)}</span>
                <Badge status={h.to}>{s(h.to)}</Badge>
                {h.reason && <span className="text-ink-600">{h.reason}</span>}
              </li>
            ))}
          </ol>
          <h3 className="mt-6 mb-2 font-semibold">{p('bookings.payments')}</h3>
          {b.payments.map((x) => (
            <p key={x.id}>{when(x.createdAt, locale)} · {x.method ? p(`method.${x.method}`) : '—'} · <Badge status={x.status}>{s(x.status)}</Badge> · {sar(x.amountHalalas, locale)}{x.refundedHalalas ? ` (−${sar(x.refundedHalalas, locale)})` : ''}</p>
          ))}
        </Card>
        <div className="space-y-6">
          {b.status === 'disputed' && (
            <Card title={t('dispute.title')}>
              <ActionForm action={resolveDispute} hidden={{ id: b.id }}>
                <Field label={t('dispute.outcome')}>
                  <select name="outcome" className={inputCls}>
                    <option value="refund">{t('dispute.refund')}</option>
                    <option value="complete">{t('dispute.complete')}</option>
                  </select>
                </Field>
                <Field label={t('dispute.amount')} hint={t('dispute.amountHint')}>
                  <input name="amount" inputMode="decimal" dir="ltr" placeholder={fromHalalas(captured)} className={inputCls} />
                </Field>
                <Field label={t('dispute.note')}><input name="note" required className={inputCls} /></Field>
                <SubmitButton>{t('dispute.resolve')}</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {captured > 0 && (
            <Card title={t('refund.title')}>
              <ActionForm action={refundBooking} hidden={{ id: b.id }} confirm={t('refund.confirm')} successText={t('refund.done')}>
                <Field label={t('refund.amount')} hint={t('refund.max', { max: sar(captured, locale) })}>
                  <input name="amount" required inputMode="decimal" dir="ltr" defaultValue={fromHalalas(captured)} className={inputCls} />
                </Field>
                <Field label={t('refund.reason')}><input name="reason" required className={inputCls} /></Field>
                <SubmitButton variant="danger">{t('refund.button')}</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
