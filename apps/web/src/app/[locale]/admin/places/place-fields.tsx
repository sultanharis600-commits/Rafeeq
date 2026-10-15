import { getTranslations } from 'next-intl/server';
import { TranslatedFields } from '@/components/translated-fields';
import { Field, inputCls } from '@/components/ui';
import type { Place } from '@/lib/types';

const LANGS = ['ar', 'en', 'ur', 'id', 'ms', 'tr'] as const;
const SECTIONS = ['makkah_gifts', 'madinah_gifts', 'dates'] as const;

export async function PlaceFields({ place, shops }: { place?: Place; shops: { id: string; name: string }[] }) {
  const t = await getTranslations('Admin.places');
  const l = await getTranslations('languages');
  const sec = await getTranslations('sections');
  return (
    <div className="space-y-4">
      <TranslatedFields name="name" label={t('name')} value={place?.name} />
      <TranslatedFields name="description" label={t('description')} value={place?.description} multiline langs={['en', 'ar']} optional />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('lat')}><input name="lat" required type="number" step="0.000001" min={-90} max={90} defaultValue={place?.lat ?? 21.4225} dir="ltr" className={inputCls} /></Field>
        <Field label={t('lng')}><input name="lng" required type="number" step="0.000001" min={-180} max={180} defaultValue={place?.lng ?? 39.8262} dir="ltr" className={inputCls} /></Field>
        <Field label={t('hours')} hint={t('hoursHint')}><input name="hoursAlways" defaultValue={place?.hours?.always ?? ''} dir="ltr" placeholder="09:00-23:00" className={inputCls} /></Field>
      </div>
      <fieldset className="rounded-lg border border-sand-300 p-3">
        <legend className="px-1 font-medium">{t('languages')}</legend>
        <div className="flex flex-wrap gap-4">
          {LANGS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="languages" value={k} defaultChecked={place?.languages.includes(k)} className="size-5" />{l(k)}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-sand-300 p-3">
        <legend className="px-1 font-medium">{t('sells')}</legend>
        <div className="flex flex-wrap gap-4">
          {SECTIONS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="sells" value={k} defaultChecked={place?.sells.includes(k)} className="size-5" />{sec(k)}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('priceRange')}>
          <select name="priceRange" defaultValue={place?.priceRange ?? ''} className={inputCls}>
            <option value="">—</option>
            <option value="1">$</option>
            <option value="2">$$</option>
            <option value="3">$$$</option>
          </select>
        </Field>
        <Field label={t('shop')} hint={t('shopHint')}>
          <select name="shopProviderId" defaultValue={place?.shopProviderId ?? ''} className={inputCls}>
            <option value="">—</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
    </div>
  );
}
