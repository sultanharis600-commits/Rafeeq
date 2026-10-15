import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, ButtonLink, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';

type PlaceRow = { id: string; type: string; city: string; name: string; lat: number; lng: number; shopOnline: { shopId: string } | null; languages: string[] };

export default async function Places({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ city?: string; type?: string }> }) {
  const { locale } = await params;
  const { city, type } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const pt = await getTranslations('placeTypes');
  const p = await getTranslations('Provider');
  const rows = await api<PlaceRow[]>('/places', { query: { city, type, lang: locale } });
  return (
    <>
      <PageHeader title={t('nav.places')} subtitle={t('places.subtitle')} actions={<ButtonLink href={`/${locale}/admin/places/new`}>{t('places.new')}</ButtonLink>} />
      <nav className="mb-4 flex flex-wrap gap-2">
        {['', 'makkah', 'madinah'].map((c) => (
          <Link key={c} href={`/${locale}/admin/places${c ? `?city=${c}` : ''}`} className={`min-h-11 rounded-full px-4 py-2 ${(city ?? '') === c ? 'bg-brand-700 text-white' : 'border border-sand-300 bg-white'}`}>
            {c ? p(`services.city.${c}`) : p('common.all')}
          </Link>
        ))}
      </nav>
      <Table head={[t('places.name'), t('places.type'), t('places.city'), t('places.coords'), '']} empty={t('none')}>
        {rows.map((x) => (
          <tr key={x.id}>
            <Td><Link className="text-brand-700 underline" href={`/${locale}/admin/places/${x.id}`}>{x.name}</Link></Td>
            <Td>{pt(x.type)}{x.shopOnline && <span className="ms-2"><Badge tone="green">{t('places.shopOnline')}</Badge></span>}</Td>
            <Td>{p(`services.city.${x.city}`)}</Td>
            <Td><a className="font-mono text-sm text-brand-700 underline" dir="ltr" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${x.lat}&mlon=${x.lng}#map=18/${x.lat}/${x.lng}`}>{x.lat.toFixed(4)}, {x.lng.toFixed(4)}</a></Td>
            <Td>{x.languages.map((l) => l.toUpperCase()).join(' ')}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
