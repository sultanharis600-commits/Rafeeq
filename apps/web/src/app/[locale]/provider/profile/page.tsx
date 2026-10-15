import { getTranslations, setRequestLocale } from 'next-intl/server';
import { updateProfile } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { TranslatedFields } from '@/components/translated-fields';
import { Badge, Card, Field, inputCls, PageHeader } from '@/components/ui';
import { percent } from '@/lib/format';
import { requireProvider } from '@/lib/session';

export default async function Profile({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const s = await getTranslations('status');
  return (
    <>
      <PageHeader title={t('nav.profile')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ActionForm action={updateProfile} hidden={{ providerId: current.id }} successText={t('common.saved')}>
            <TranslatedFields name="name" label={t('apply.name')} value={current.name} langs={['en', 'ar']} />
            <TranslatedFields name="description" label={t('services.description')} value={current.description} multiline langs={['en', 'ar']} optional />
            <Field label={t('apply.phone')}><input name="phone" dir="ltr" defaultValue={current.phone ?? ''} pattern="^\+[1-9]\d{7,14}$" className={inputCls} /></Field>
            <Field label={t('apply.iban')} hint={current.ibanLast4 ? t('profile.ibanOnFile', { last4: current.ibanLast4 }) : t('profile.noIban')}>
              <input name="iban" dir="ltr" placeholder="SA…" className={inputCls} />
            </Field>
            <SubmitButton>{t('common.save')}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t('profile.account')}>
          <dl className="space-y-2">
            <div><dt className="text-sm text-ink-600">{t('common.status')}</dt><dd><Badge status={current.status}>{s(current.status)}</Badge></dd></div>
            <div><dt className="text-sm text-ink-600">{t('apply.type')}</dt><dd>{t(`apply.types.${current.type}`)} · {t(`apply.kinds.${current.kind}`)}</dd></div>
            <div><dt className="text-sm text-ink-600">{t('apply.cr')}</dt><dd dir="ltr" className="text-start">{current.crNumber ?? '—'}</dd></div>
            <div><dt className="text-sm text-ink-600">{t('profile.commission')}</dt><dd>{percent(current.commissionRateBps, locale)}</dd></div>
            <div>
              <dt className="text-sm text-ink-600">{t('profile.documents')}</dt>
              <dd>
                {(current.documents ?? []).map((d, i) => (
                  <p key={i}>{d.kind} {d.verified ? <Badge tone="green">{t('profile.verified')}</Badge> : <Badge tone="gold">{t('profile.unverified')}</Badge>}</p>
                ))}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
