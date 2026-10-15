import { getTranslations } from 'next-intl/server';
import { TranslatedFields } from '@/components/translated-fields';
import { Field, inputCls } from '@/components/ui';
import { fromHalalas } from '@/lib/format';
import type { Product } from '@/lib/types';

const SECTIONS = ['makkah_gifts', 'madinah_gifts', 'dates'] as const;

export async function ProductFields({ product }: { product?: Product }) {
  const t = await getTranslations('Provider.products');
  const sv = await getTranslations('Provider.services');
  const sec = await getTranslations('sections');
  return (
    <div className="space-y-4">
      <Field label={t('section')}>
        <select name="section" required className={inputCls} defaultValue={product?.section ?? 'makkah_gifts'}>
          {SECTIONS.map((s) => <option key={s} value={s}>{sec(s)}</option>)}
        </select>
      </Field>
      <TranslatedFields name="title" label={sv('titleLabel')} value={product?.title} />
      <TranslatedFields name="description" label={sv('description')} value={product?.description} multiline optional />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={sv('price')} hint={sv('priceHint')}>
          <input name="price" required inputMode="decimal" dir="ltr" pattern="^\d+([.,]\d{1,2})?$" defaultValue={product ? fromHalalas(product.priceHalalas) : ''} className={inputCls} />
        </Field>
        <Field label={t('stock')}>
          <input name="stock" type="number" min={0} required defaultValue={product?.stock ?? 10} className={inputCls} />
        </Field>
        <Field label={t('lowStockAlert')}>
          <input name="lowStockAlert" type="number" min={0} defaultValue={product?.lowStockAlert ?? 5} className={inputCls} />
        </Field>
        <Field label={t('weight')}>
          <input name="weightGrams" type="number" min={1} required defaultValue={product?.weightGrams ?? 500} className={inputCls} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="isFood" defaultChecked={product?.isFood} className="size-5" />
          {t('isFood')}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="shipsAbroad" defaultChecked={product?.shipsAbroad ?? true} className="size-5" />
          {t('shipsAbroad')}
        </label>
      </div>
      <Field label={t('countries')} hint={t('countriesHint')}>
        <input name="shipsToCountries" dir="ltr" defaultValue={product?.shipsToCountries.join(', ') ?? ''} placeholder="ID, MY, PK" className={inputCls} />
      </Field>
    </div>
  );
}
