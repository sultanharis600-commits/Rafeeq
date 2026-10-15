import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Shell, type NavItem } from '@/components/shell';
import { Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { Overview } from '@/lib/types';

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireAdmin(locale);
  const t = await getTranslations('Admin');
  const ov = await api<Overview>('/admin/overview');
  const base = `/${locale}/admin`;
  const nav: NavItem[] = [
    { href: base, label: t('nav.overview') },
    { href: `${base}/providers`, label: t('nav.providers'), badge: ov.providers.pending },
    { href: `${base}/bookings`, label: t('nav.bookings'), badge: ov.bookings.disputes },
    { href: `${base}/orders`, label: t('nav.orders') },
    { href: `${base}/payments`, label: t('nav.payments') },
    { href: `${base}/payouts`, label: t('nav.payouts') },
    { href: `${base}/bags`, label: t('nav.bags'), badge: ov.safety.openBagCases },
    { href: `${base}/alerts`, label: t('nav.alerts'), badge: ov.safety.openLostAlerts },
    { href: `${base}/places`, label: t('nav.places') },
    { href: `${base}/content`, label: t('nav.content') },
    { href: `${base}/outbox`, label: t('nav.outbox') },
    { href: `${base}/audit`, label: t('nav.audit') },
    { href: `${base}/users`, label: t('nav.users') },
  ];
  return (
    <Shell locale={locale} title={t('title')} userName={me.name} nav={nav} top={<Badge tone="blue">{t(`roles.${me.role}`)}</Badge>}>
      {children}
    </Shell>
  );
}
