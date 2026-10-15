import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BagTimelineView } from '@/components/bag-timeline';
import { Badge, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { requireProvider } from '@/lib/session';
import type { BagTimeline } from '@/lib/types';

export default async function BagPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireProvider(locale);
  const s = await getTranslations('status');
  const bag = await api<BagTimeline>(`/bags/${id}`);
  return (
    <>
      <PageHeader title={`${bag.tagCode}${bag.label ? ` · ${bag.label}` : ''}`} actions={<Badge status={bag.status}>{s(bag.status)}</Badge>} />
      <BagTimelineView bag={bag} locale={locale} />
    </>
  );
}
