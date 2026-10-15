import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { when } from '@/lib/format';

type Row = { log: { id: string; action: string; entityType: string | null; entityId: string | null; data: unknown; at: string }; actor: string | null; role: string | null };

export default async function Audit({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const page = await api<Page<Row>>('/admin/audit-log', { query: { limit: 100 } });
  return (
    <>
      <PageHeader title={t('nav.audit')} subtitle={t('audit.subtitle')} />
      <Table head={[t('audit.when'), t('audit.who'), t('audit.action'), t('audit.target'), t('audit.data')]} empty={t('none')}>
        {page.items.map((r) => (
          <tr key={r.log.id}>
            <Td className="whitespace-nowrap">{when(r.log.at, locale)}</Td>
            <Td>{r.actor ?? '—'}{r.role && <p className="text-sm text-ink-600">{t(`roles.${r.role}`)}</p>}</Td>
            <Td className="font-mono text-sm">{r.log.action}</Td>
            <Td className="font-mono text-sm">{r.log.entityType ? `${r.log.entityType}:${r.log.entityId?.slice(0, 8)}` : '—'}</Td>
            <Td><pre className="max-w-xs overflow-x-auto text-xs" dir="ltr">{r.log.data ? JSON.stringify(r.log.data) : ''}</pre></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
