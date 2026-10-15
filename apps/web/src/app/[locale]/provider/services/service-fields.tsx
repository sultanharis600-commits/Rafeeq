import { getTranslations } from 'next-intl/server';
import { TranslatedFields } from '@/components/translated-fields';
import { Field, inputCls } from '@/components/ui';
import { fromHalalas } from '@/lib/format';
import type { ServiceRow } from '@/lib/types';

export const CATEGORIES = ['transport', 'guides', 'photography', 'luggage', 'accessibility', 'heritage_tours'] as const;
const PRICE_MODELS = ['per_trip', 'per_hour', 'per_person', 'per_bag', 'per_tag', 'fixed'] as const;
const POLICIES = ['flexible', 'moderate', 'strict'] as const;
const LANGS = ['ar', 'en', 'ur', 'id', 'ms', 'tr'] as const;

/** Fields shared by the create and edit service forms. Prices are typed in SAR and stored as halalas. */
export async function ServiceFields({ service, withCategory }: { service?: ServiceRow; withCategory?: boolean }) {
  const t = await getTranslations('Provider.services');
  const l = await getTranslations('languages');
  const c = await getTranslations('categories');
  const options = [...(service?.options ?? []), { key: '', title: { en: '' }, priceHalalas: 0 }];
  return (
    <div className="space-y-4">
      {withCategory && (
        <Field label={t('category')}>
          <select name="category" required className={inputCls} defaultValue="">
            <option value="" disabled>—</option>
            {CATEGORIES.map((k) => <option key={k} value={k}>{c(k)}</option>)}
          </select>
        </Field>
      )}
      <TranslatedFields name="title" label={t('titleLabel')} value={service?.title} />
      <TranslatedFields name="description" label={t('description')} value={service?.description} multiline optional />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('price')} hint={t('priceHint')}>
          <input name="price" required inputMode="decimal" dir="ltr" pattern="^\d+([.,]\d{1,2})?$" defaultValue={service ? fromHalalas(service.priceHalalas) : ''} className={inputCls} />
        </Field>
        <Field label={t('priceModel')}>
          <select name="priceModel" required className={inputCls} defaultValue={service?.priceModel ?? 'per_trip'}>
            {PRICE_MODELS.map((m) => <option key={m} value={m}>{t(`model.${m}`)}</option>)}
          </select>
        </Field>
        <Field label={t('duration')}>
          <input name="durationMinutes" type="number" min={5} max={43200} defaultValue={service?.durationMinutes ?? 60} className={inputCls} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('area')}>
          <select name="serviceArea" required className={inputCls} defaultValue={service?.serviceArea ?? 'makkah'}>
            <option value="makkah">{t('city.makkah')}</option>
            <option value="madinah">{t('city.madinah')}</option>
          </select>
        </Field>
        <Field label={t('policy')} hint={t('policyHint')}>
          <select name="cancellationPolicy" className={inputCls} defaultValue={service?.cancellationPolicy ?? 'flexible'}>
            {POLICIES.map((p) => <option key={p} value={p}>{t(`policies.${p}`)}</option>)}
          </select>
        </Field>
      </div>
      <fieldset className="rounded-lg border border-sand-300 p-3">
        <legend className="px-1 font-medium">{t('languagesSpoken')}</legend>
        <div className="flex flex-wrap gap-4">
          {LANGS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="languagesSpoken" value={k} defaultChecked={service?.languagesSpoken.includes(k) ?? k === 'ar'} className="size-5" />
              {l(k)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2 rounded-lg border border-sand-300 p-3">
        <legend className="px-1 font-medium">{t('options')}</legend>
        <p className="text-sm text-ink-600">{t('optionsHint')}</p>
        {options.map((o, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <input name="option.key" aria-label={t('optionKey')} placeholder={t('optionKey')} pattern="^[a-z0-9_]{1,40}$" dir="ltr" defaultValue={o.key} className={inputCls} />
            <input name="option.title" aria-label={t('optionTitle')} placeholder={t('optionTitle')} defaultValue={o.title.en} className={inputCls} />
            <input name="option.price" aria-label={t('optionPrice')} placeholder={t('optionPrice')} inputMode="decimal" dir="ltr" defaultValue={o.key ? fromHalalas(o.priceHalalas) : ''} className={inputCls} />
          </div>
        ))}
      </fieldset>
    </div>
  );
}
