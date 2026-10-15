import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createService } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card, PageHeader } from '@/components/ui';
import { requireProvider } from '@/lib/session';
import { ServiceFields } from '../service-fields';

export default async function NewService({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  return (
    <>
      <PageHeader title={t('services.new')} subtitle={t('services.newHint')} />
      <Card>
        <ActionForm action={createService} hidden={{ providerId: current.id }} resetOnSuccess successText={t('services.created')}>
          <ServiceFields withCategory />
          <SubmitButton>{t('common.save')}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
