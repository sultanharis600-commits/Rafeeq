import { getTranslations, setRequestLocale } from 'next-intl/server';
import { applyProvider } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { TranslatedFields } from '@/components/translated-fields';
import { Card, Field, inputCls, PageHeader } from '@/components/ui';
import { requireProvider } from '@/lib/session';

/** Onboarding: business details, Commercial Registration or ID, IBAN; Bidec verifies before listings go live. */
export default async function Apply({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireProvider(locale);
  const t = await getTranslations('Provider');
  return (
    <>
      <PageHeader title={t('apply.title')} subtitle={t('apply.subtitle')} />
      <Card>
        <ActionForm action={applyProvider} resetOnSuccess successText={t('apply.sent')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('apply.type')}>
              <select name="type" required className={inputCls}>
                <option value="company">{t('apply.types.company')}</option>
                <option value="individual">{t('apply.types.individual')}</option>
              </select>
            </Field>
            <Field label={t('apply.kind')}>
              <select name="kind" required className={inputCls}>
                <option value="services">{t('apply.kinds.services')}</option>
                <option value="shop">{t('apply.kinds.shop')}</option>
              </select>
            </Field>
            <Field label={t('apply.city')}>
              <select name="city" required className={inputCls}>
                <option value="makkah">{t('services.city.makkah')}</option>
                <option value="madinah">{t('services.city.madinah')}</option>
              </select>
            </Field>
          </div>
          <TranslatedFields name="name" label={t('apply.name')} langs={['en', 'ar']} />
          <TranslatedFields name="description" label={t('services.description')} multiline langs={['en', 'ar']} optional />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('apply.cr')} hint={t('apply.crHint')}><input name="crNumber" dir="ltr" pattern="^\d{10}$" className={inputCls} /></Field>
            <Field label={t('apply.phone')}><input name="phone" dir="ltr" pattern="^\+[1-9]\d{7,14}$" className={inputCls} /></Field>
            <Field label={t('apply.iban')} hint={t('apply.ibanHint')}><input name="iban" dir="ltr" placeholder="SA…" className={inputCls} /></Field>
          </div>
          <Field label={t('apply.documents')} hint={t('apply.documentsHint')}>
            <input name="idDocument" type="file" required accept="application/pdf,image/jpeg,image/png" className={`${inputCls} py-2`} />
          </Field>
          <Field label={t('apply.licence')} hint={t('apply.documentsHint')}>
            <input name="licence" type="file" accept="application/pdf,image/jpeg,image/png" className={`${inputCls} py-2`} />
          </Field>
          <SubmitButton>{t('apply.submit')}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
