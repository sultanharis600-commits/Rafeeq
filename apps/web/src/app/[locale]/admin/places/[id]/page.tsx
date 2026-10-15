import { getTranslations, setRequestLocale } from 'next-intl/server';
import { deletePlace, updatePlace } from '@/app/actions/admin';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { Card, PageHeader } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { pick } from '@/lib/format';
import type { Place, Provider } from '@/lib/types';
import { PlaceFields } from '../place-fields';

export default async function EditPlace({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const pt = await getTranslations('placeTypes');
  // The map pack holds the full record with every language.
  const [mk, md, shops] = await Promise.all([
    api<{ places: Place[] }>('/map-packs/makkah'),
    api<{ places: Place[] }>('/map-packs/madinah'),
    api<Page<Provider>>('/admin/providers', { query: { kind: 'shop', status: 'approved', limit: 100 } }),
  ]);
  const place = [...mk.places, ...md.places].find((x) => x.id === id);
  if (!place) return <p>{t('none')}</p>;
  return (
    <>
      <PageHeader
        title={pick(place.name, locale)}
        subtitle={`${pt(place.type)} · ${p(`services.city.${place.city}`)}`}
        actions={<ActionButton action={deletePlace} hidden={{ id }} variant="danger" confirm={t('places.deleteConfirm')}>{t('places.delete')}</ActionButton>}
      />
      <Card>
        <ActionForm action={updatePlace} hidden={{ id }} successText={p('common.saved')}>
          <PlaceFields place={place} shops={shops.items.map((s) => ({ id: s.id, name: pick(s.name, locale) }))} />
          <SubmitButton>{p('common.save')}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
