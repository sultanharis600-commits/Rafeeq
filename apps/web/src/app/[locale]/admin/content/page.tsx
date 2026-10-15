import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createContent, toggleContent } from '@/app/actions/admin';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { TranslatedFields } from '@/components/translated-fields';
import { Badge, Card, Field, inputCls, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { pick } from '@/lib/format';
import type { Translated } from '@/lib/types';

type Item = { id: string; kind: string; title: Translated; body: Translated | null; link: string | null; city: string | null; active: boolean };

export default async function Content({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const items = await api<Item[]>('/admin/content');
  return (
    <>
      <PageHeader title={t('nav.content')} subtitle={t('content.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {items.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p><Badge tone={c.kind === 'banner' ? 'blue' : 'gold'}>{t(`content.kinds.${c.kind}`)}</Badge>{!c.active && <span className="ms-2"><Badge tone="grey">{p('services.hidden')}</Badge></span>}</p>
                  <p className="mt-1 font-medium">{pick(c.title, locale)}</p>
                  {c.body && <p className="text-ink-600">{pick(c.body, locale)}</p>}
                  {c.link && <p className="font-mono text-sm" dir="ltr">{c.link}</p>}
                  <p className="text-sm text-ink-600">{t('content.languages', { list: Object.keys(c.title).join(', ').toUpperCase() })}</p>
                </div>
                <ActionButton action={toggleContent} hidden={{ id: c.id, active: String(!c.active) }} variant="secondary">
                  {c.active ? p('services.hide') : p('services.show')}
                </ActionButton>
              </div>
            </Card>
          ))}
        </div>
        <Card title={t('content.new')}>
          <ActionForm action={createContent} resetOnSuccess successText={t('content.created')}>
            <Field label={t('content.kind')}>
              <select name="kind" className={inputCls}>
                <option value="banner">{t('content.kinds.banner')}</option>
                <option value="help">{t('content.kinds.help')}</option>
              </select>
            </Field>
            <TranslatedFields name="title" label={t('content.title')} />
            <TranslatedFields name="body" label={t('content.body')} multiline optional />
            <Field label={t('content.link')} hint={t('content.linkHint')}><input name="link" dir="ltr" placeholder="rafeeq://services?category=luggage" className={inputCls} /></Field>
            <SubmitButton>{p('common.save')}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
