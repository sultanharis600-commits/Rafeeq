import { getTranslations, setRequestLocale } from 'next-intl/server';
import { generateSlots, updateService, updateSlot } from '@/app/actions/provider';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Field, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { pick, saudiToday, when } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { ServiceRow, Slot } from '@/lib/types';
import { ServiceFields } from '../service-fields';

export default async function EditService({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const services = await api<ServiceRow[]>('/provider/services', { query: { providerId: current.id } });
  const service = services.find((s) => s.id === id);
  if (!service) return <p>{t('common.nothing')}</p>;
  const slots = await api<Slot[]>(`/provider/services/${id}/slots`, { query: { from: new Date().toISOString() } });

  return (
    <>
      <PageHeader title={pick(service.title, locale)} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t('services.edit')}>
          <ActionForm action={updateService} hidden={{ id }} successText={t('common.saved')}>
            <ServiceFields service={service} />
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={service.active} className="size-5" />
              {t('services.visible')}
            </label>
            <SubmitButton>{t('common.save')}</SubmitButton>
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card title={t('slots.generate')}>
            <ActionForm action={generateSlots} hidden={{ id }} successText={t('slots.generated')}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t('slots.fromDate')}>
                  <input type="date" name="fromDate" required defaultValue={saudiToday(1)} className={inputCls} />
                </Field>
                <Field label={t('slots.days')}>
                  <input type="number" name="days" min={1} max={60} defaultValue={7} required className={inputCls} />
                </Field>
                <Field label={t('slots.capacity')} hint={t('slots.capacityHint')}>
                  <input type="number" name="capacity" min={1} max={1000} defaultValue={1} required className={inputCls} />
                </Field>
              </div>
              <fieldset>
                <legend className="mb-2 font-medium">{t('slots.hours')}</legend>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <label key={h} className="flex min-h-11 items-center gap-1">
                      <input type="checkbox" name="hours" value={h} className="size-5" />
                      <span dir="ltr">{String(h).padStart(2, '0')}:00</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <SubmitButton>{t('slots.create')}</SubmitButton>
            </ActionForm>
          </Card>
          <Card title={t('slots.upcoming')}>
            <Table head={[t('slots.start'), t('slots.booked'), t('slots.capacity'), '']} empty={t('slots.none')}>
              {slots.slice(0, 60).map((s) => (
                <tr key={s.id}>
                  <Td>{when(s.startsAt, locale)}</Td>
                  <Td>
                    {s.booked}
                    {s.held > 0 && <span className="ms-1 text-sm text-ink-600">{t('slots.held', { n: s.held })}</span>}
                  </Td>
                  <Td>
                    <ActionForm action={updateSlot} hidden={{ id: s.id }} className="flex gap-2">
                      <input name="capacity" type="number" min={s.booked + s.held} max={1000} defaultValue={s.capacity} aria-label={t('slots.capacity')} className={`${inputCls} w-20`} />
                      <SubmitButton variant="secondary">{t('common.save')}</SubmitButton>
                    </ActionForm>
                  </Td>
                  <Td>
                    {s.blocked ? (
                      <div className="flex items-center gap-2">
                        <Badge tone="red">{t('slots.blocked')}</Badge>
                        <ActionButton action={updateSlot} hidden={{ id: s.id, blocked: 'false' }} variant="secondary">{t('slots.unblock')}</ActionButton>
                      </div>
                    ) : (
                      <ActionButton action={updateSlot} hidden={{ id: s.id, blocked: 'true' }} variant="secondary">{t('slots.block')}</ActionButton>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
