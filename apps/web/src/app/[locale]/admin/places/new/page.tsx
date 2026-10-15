import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createPlace } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card, Field, inputCls, PageHeader } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { pick } from '@/lib/format';
import type { Provider } from '@/lib/types';
import { PlaceFields } from '../place-fields';

const TYPES = ['holy_site', 'gate', 'gathering_point', 'lost_and_found', 'hotel', 'toilet', 'shopping'] as const;

export default async function NewPlace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const pt = await getTranslations('placeTypes');
  const p = await getTranslations('Provider');
  const shops = await api<Page<Provider>>('/admin/providers', { query: { kind: 'shop', status: 'approved', limit: 100 } });
  return (
    <>
      <PageHeader title={t('places.new')} subtitle={t('places.checkOnSite')} />
      <Card>
        <ActionForm action={createPlace} resetOnSuccess successText={t('places.created')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('places.type')}>
              <select name="type" required className={inputCls}>{TYPES.map((x) => <option key={x} value={x}>{pt(x)}</option>)}</select>
            </Field>
            <Field label={t('places.city')}>
              <select name="city" required className={inputCls}>
                <option value="makkah">{p('services.city.makkah')}</option>
                <option value="madinah">{p('services.city.madinah')}</option>
              </select>
            </Field>
          </div>
          <PlaceFields shops={shops.items.map((s) => ({ id: s.id, name: pick(s.name, locale) }))} />
          <SubmitButton>{p('common.save')}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
