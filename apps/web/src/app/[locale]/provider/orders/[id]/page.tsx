import { getTranslations, setRequestLocale } from 'next-intl/server';
import { orderStep } from '@/app/actions/provider';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Field, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { sar, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { OrderDetail } from '@/lib/types';

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireProvider(locale);
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  const o = await api<OrderDetail>(`/orders/${id}`, { query: { lang: locale } });
  const addr = o.address;

  return (
    <>
      <PageHeader
        title={t('orders.order', { ref: o.id.slice(0, 8).toUpperCase() })}
        subtitle={when(o.createdAt, locale)}
        actions={
          <>
            <Badge status={o.status}>{s(o.status)}</Badge>
            <a className="inline-flex min-h-12 items-center rounded-lg border border-brand-700 px-4 text-brand-700" href={`/api/invoices/order/${o.id}`}>{t('bookings.invoice')}</a>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={t('orders.items')}>
            <Table head={[t('orders.product'), t('bookings.quantity'), t('orders.unit'), t('common.total')]}>
              {o.items.map((i) => (
                <tr key={i.productId}>
                  <Td>{i.title}</Td>
                  <Td>{i.quantity}</Td>
                  <Td>{sar(i.unitPriceHalalas, locale)}</Td>
                  <Td>{sar(i.unitPriceHalalas * i.quantity, locale)}</Td>
                </tr>
              ))}
            </Table>
            <dl className="mt-4 space-y-1">
              <Row label={t('orders.subtotal')} value={sar(o.subtotalHalalas, locale)} />
              <Row label={t('orders.shipping')} value={sar(o.shippingHalalas, locale)} />
              {o.giftWrapHalalas > 0 && <Row label={t('orders.giftWrap')} value={sar(o.giftWrapHalalas, locale)} />}
              <Row label={t('common.total')} value={sar(o.totalHalalas, locale)} bold />
            </dl>
          </Card>
          <Card title={t('bookings.history')}>
            <ol className="space-y-2">
              {o.history.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-2">
                  <span className="text-ink-600">{when(h.at, locale)}</span>
                  <Badge status={h.to}>{s(h.to)}</Badge>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title={t('orders.delivery')}>
            <p className="font-medium">{o.buyer?.name}</p>
            {o.buyer?.phone && <p dir="ltr" className="text-start">{o.buyer.phone}</p>}
            {addr.kind === 'hotel' ? (
              <p className="mt-2">{o.hotel?.name}{addr.room ? ` · ${t('orders.room', { room: addr.room })}` : ''}</p>
            ) : (
              <p className="mt-2" dir="ltr">{addr.line1}, {addr.city} {addr.postcode ?? ''}, {addr.country}</p>
            )}
            {o.giftMessage && <p className="mt-2 rounded-lg bg-gold-500/10 p-2">{t('orders.giftMessage')}: “{o.giftMessage}”</p>}
            {o.trackingNumber && <p className="mt-2">{o.courier} · <span className="font-mono">{o.trackingNumber}</span></p>}
          </Card>
          <Card title={t('bookings.actions')}>
            <div className="flex flex-col gap-3">
              {o.status === 'paid' && <ActionButton action={orderStep} hidden={{ id: o.id, step: 'pack' }}>{t('orders.pack')}</ActionButton>}
              {o.status === 'packed' && o.deliveryType === 'hotel' && <ActionButton action={orderStep} hidden={{ id: o.id, step: 'out-for-delivery' }}>{t('orders.outForDelivery')}</ActionButton>}
              {o.status === 'packed' && o.deliveryType === 'international' && (
                <ActionForm action={orderStep} hidden={{ id: o.id, step: 'ship' }}>
                  <Field label={t('orders.courier')}><input name="courier" required className={inputCls} /></Field>
                  <Field label={t('orders.tracking')}><input name="trackingNumber" required dir="ltr" className={inputCls} /></Field>
                  <SubmitButton>{t('orders.ship')}</SubmitButton>
                </ActionForm>
              )}
              {['out_for_delivery', 'shipped'].includes(o.status) && <ActionButton action={orderStep} hidden={{ id: o.id, step: 'deliver' }}>{t('orders.markDelivered')}</ActionButton>}
              {['paid', 'packed'].includes(o.status) && (
                <ActionForm action={orderStep} hidden={{ id: o.id, step: 'cancel' }} confirm={t('orders.cancelConfirm')}>
                  <input name="reason" required placeholder={t('bookings.cancelReason')} className={inputCls} />
                  <SubmitButton variant="danger">{t('orders.cancel')}</SubmitButton>
                </ActionForm>
              )}
              {['delivered', 'cancelled', 'refunded'].includes(o.status) && <p className="text-ink-600">{t('bookings.noActions')}</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
