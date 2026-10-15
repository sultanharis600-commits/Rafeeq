import { getTranslations, setRequestLocale } from 'next-intl/server';
import { updateProduct } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { pick } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { Product } from '@/lib/types';
import { ProductFields } from '../product-fields';

export default async function EditProduct({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const product = (await api<Product[]>('/provider/products', { query: { shopId: current.id } })).find((p) => p.id === id);
  if (!product) return <p>{t('common.nothing')}</p>;
  return (
    <>
      <PageHeader title={pick(product.title, locale)} />
      <Card>
        <ActionForm action={updateProduct} hidden={{ id }} successText={t('common.saved')}>
          <ProductFields product={product} />
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={product.active} className="size-5" />
            {t('services.visible')}
          </label>
          <SubmitButton>{t('common.save')}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
