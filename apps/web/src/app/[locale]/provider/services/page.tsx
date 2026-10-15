import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { toggleService } from '@/app/actions/provider';
import { ActionButton } from '@/components/forms';
import { Badge, ButtonLink, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { pick, sar } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { ServiceRow } from '@/lib/types';

export default async function Services({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const c = await getTranslations('categories');
  const rows = await api<ServiceRow[]>('/provider/services', { query: { providerId: current.id } });
  return (
    <>
      <PageHeader title={t('nav.services')} actions={<ButtonLink href={`/${locale}/provider/services/new`}>{t('services.new')}</ButtonLink>} />
      <Table head={[t('services.titleLabel'), t('services.category'), t('services.price'), t('services.area'), t('common.status'), '']} empty={t('services.none')}>
        {rows.map((s) => (
          <tr key={s.id}>
            <Td>
              <Link className="text-brand-700 underline" href={`/${locale}/provider/services/${s.id}`}>{pick(s.title, locale)}</Link>
              <p className="text-sm text-ink-600">{s.languagesSpoken.map((l) => l.toUpperCase()).join(' · ')}</p>
            </Td>
            <Td>{c(s.category)}</Td>
            <Td>{sar(s.priceHalalas, locale)} <span className="text-sm text-ink-600">{t(`services.model.${s.priceModel}`)}</span></Td>
            <Td>{t(`services.city.${s.serviceArea}`)}</Td>
            <Td>{s.active ? <Badge tone="green">{t('services.active')}</Badge> : <Badge tone="grey">{t('services.hidden')}</Badge>}</Td>
            <Td>
              <ActionButton action={toggleService} hidden={{ id: s.id, active: String(!s.active) }} variant="secondary">
                {s.active ? t('services.hide') : t('services.show')}
              </ActionButton>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
