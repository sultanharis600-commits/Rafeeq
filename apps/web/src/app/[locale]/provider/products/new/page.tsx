import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createProduct } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card, PageHeader } from '@/components/ui';
import { requireProvider } from '@/lib/session';
import { ProductFields } from '../product-fields';

export default async function NewProduct({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  return (
    <>
      <PageHeader title={t('products.new')} />
      <Card>
        <ActionForm action={createProduct} hidden={{ shopId: current.id }} resetOnSuccess successText={t('products.created')}>
          <ProductFields />
          <SubmitButton>{t('common.save')}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
