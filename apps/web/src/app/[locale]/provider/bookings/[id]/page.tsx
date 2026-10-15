import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { acceptBooking, assignStaff, cancelBooking, completeBooking, startBooking } from '@/app/actions/provider';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { sar, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { BookingDetail, Staff } from '@/lib/types';
import { DeclineForm } from '../decline-form';

export default async function BookingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const [b, staff] = await Promise.all([
    api<BookingDetail>(`/bookings/${id}`, { query: { lang: locale } }),
    api<Staff[]>(`/providers/${current.id}/staff`),
  ]);
  const active = staff.filter((m) => m.active);

  return (
    <>
      <PageHeader
        title={b.service.title}
        subtitle={when(b.slot?.startsAt, locale)}
        actions={
          <>
            <Badge status={b.status}>{s(b.status)}</Badge>
            <a className="inline-flex min-h-12 items-center rounded-lg border border-brand-700 px-4 text-brand-700" href={`/api/invoices/booking/${b.id}`}>
              {t('bookings.invoice')}
            </a>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={t('bookings.details')}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item label={t('bookings.pilgrim')} value={b.pilgrim ? `${b.pilgrim.name} · ${b.pilgrim.language.toUpperCase()}${b.pilgrim.phone ? ` · ${b.pilgrim.phone}` : ''}` : '—'} />
              <Item label={t('bookings.quantity')} value={String(b.quantity)} />
              <Item label={t('common.total')} value={sar(b.totalHalalas, locale)} />
              <Item label={t('bookings.options')} value={b.options.join(', ') || '—'} />
              <Item label={t('bookings.meetingPoint')} value={b.meetingPoint ?? '—'} />
              <Item label={t('bookings.pickup')} value={b.pickup?.label ?? '—'} />
              <Item label={t('bookings.dropoff')} value={b.dropoff?.label ?? '—'} />
              <Item label={t('bookings.acceptBy')} value={when(b.acceptBy, locale)} />
            </dl>
            {(b.needs.length > 0 || b.notes) && (
              <div className="mt-4 rounded-lg bg-gold-500/10 p-3">
                <p className="font-medium">{t('bookings.needs')}</p>
                <p>{b.needs.map((n) => t(`needs.${n}`)).join(' · ')}</p>
                {b.notes && <p className="mt-1">{b.notes}</p>}
              </div>
            )}
          </Card>

          {b.bags.length > 0 && (
            <Card title={t('nav.bags')}>
              <Table head={[t('bags.tag'), t('bags.label'), t('common.status')]}>
                {b.bags.map((g) => (
                  <tr key={g.id}>
                    <Td><Link className="font-mono text-brand-700 underline" href={`/${locale}/provider/bags/${g.id}`}>{g.tagCode}</Link></Td>
                    <Td>{g.label ?? '—'}</Td>
                    <Td><Badge status={g.status}>{s(g.status)}</Badge></Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          <Card title={t('bookings.history')}>
            <ol className="space-y-2">
              {b.history.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-2">
                  <span className="text-ink-600">{when(h.at, locale)}</span>
                  <Badge status={h.to}>{s(h.to)}</Badge>
                  {h.reason && h.reason !== 'sample data' && <span className="text-ink-600">{h.reason}</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t('bookings.actions')}>
            <div className="flex flex-col gap-3">
              {b.status === 'paid' && (
                <>
                  <ActionButton action={acceptBooking} hidden={{ id: b.id }}>{t('bookings.accept')}</ActionButton>
                  <DeclineForm id={b.id} />
                </>
              )}
              {['accepted', 'in_progress'].includes(b.status) && (
                <ActionForm key={b.staff?.id ?? 'none'} action={assignStaff} hidden={{ id: b.id }} successText={t('common.saved')}>
                  <label className="block">
                    <span className="mb-1 block font-medium">{t('bookings.assign')}</span>
                    <select name="staffId" defaultValue={b.staff?.id ?? ''} required className={inputCls}>
                      <option value="" disabled>{t('bookings.chooseStaff')}</option>
                      {active.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {t(`staffRole.${m.staffRole}`)}{m.vehicle ? ` · ${m.vehicle}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton>{t('bookings.assignButton')}</SubmitButton>
                </ActionForm>
              )}
              {b.status === 'accepted' && <ActionButton action={startBooking} hidden={{ id: b.id }} variant="secondary">{t('bookings.start')}</ActionButton>}
              {b.status === 'in_progress' && <ActionButton action={completeBooking} hidden={{ id: b.id }}>{t('bookings.complete')}</ActionButton>}
              {b.status === 'accepted' && (
                <ActionForm action={cancelBooking} hidden={{ id: b.id }} confirm={t('bookings.cancelConfirm')}>
                  <input name="reason" required placeholder={t('bookings.cancelReason')} className={inputCls} />
                  <SubmitButton variant="danger">{t('bookings.cancel')}</SubmitButton>
                </ActionForm>
              )}
              {!['paid', 'accepted', 'in_progress'].includes(b.status) && <p className="text-ink-600">{t('bookings.noActions')}</p>}
            </div>
          </Card>
          {b.staff && (
            <Card title={t('bookings.assigned')}>
              <p className="font-medium">{b.staff.name}</p>
              <p className="text-ink-600">{t(`staffRole.${b.staff.staffRole}`)}{b.staff.vehicle ? ` · ${b.staff.vehicle}` : ''}</p>
              {b.liveLocation && (
                <a className="mt-2 inline-block text-brand-700 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${b.liveLocation.lat}&mlon=${b.liveLocation.lng}#map=17/${b.liveLocation.lat}/${b.liveLocation.lng}`}>
                  {t('bookings.liveLocation', { time: when(b.liveLocation.at, locale, { timeStyle: 'short' }) })}
                </a>
              )}
            </Card>
          )}
          <Card title={t('bookings.payments')}>
            {b.payments.map((p) => (
              <p key={p.id} className="flex justify-between gap-2">
                <span>{p.method ? t(`method.${p.method}`) : '—'} · <Badge status={p.status}>{s(p.status)}</Badge></span>
                <span>{sar(p.amountHalalas - p.refundedHalalas, locale)}</span>
              </p>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
