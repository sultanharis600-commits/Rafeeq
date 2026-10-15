import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { restock } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, ButtonLink, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { pick, sar } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { Product } from '@/lib/types';

export default async function Products({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const sec = await getTranslations('sections');
  const rows = await api<Product[]>('/provider/products', { query: { shopId: current.id } });
  return (
    <>
      <PageHeader title={t('nav.products')} actions={<ButtonLink href={`/${locale}/provider/products/new`}>{t('products.new')}</ButtonLink>} />
      <Table head={[t('orders.product'), t('products.section'), t('services.price'), t('products.stock'), t('products.shipping')]} empty={t('products.none')}>
        {rows.map((p) => (
          <tr key={p.id}>
            <Td>
              <Link className="text-brand-700 underline" href={`/${locale}/provider/products/${p.id}`}>{pick(p.title, locale)}</Link>
              {!p.active && <span className="ms-2"><Badge tone="grey">{t('services.hidden')}</Badge></span>}
            </Td>
            <Td>{sec(p.section)}</Td>
            <Td>{sar(p.priceHalalas, locale)}</Td>
            <Td>
              <ActionForm action={restock} hidden={{ id: p.id }} className="flex items-center gap-2">
                <input name="stock" type="number" min={0} defaultValue={p.stock} aria-label={t('products.stock')} className={`${inputCls} w-24`} />
                <SubmitButton variant="secondary">{t('common.save')}</SubmitButton>
                {p.lowStock && <Badge tone="red">{t('products.low')}</Badge>}
              </ActionForm>
            </Td>
            <Td>
              {p.shipsAbroad ? (p.shipsToCountries.length ? p.shipsToCountries.join(', ') : t('products.anyCountry')) : t('products.hotelOnly')}
              {p.isFood && <p className="text-sm text-ink-600">{t('products.food')}</p>}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
