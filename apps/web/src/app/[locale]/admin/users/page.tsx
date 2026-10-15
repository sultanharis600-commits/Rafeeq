import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { day } from '@/lib/format';

type U = { id: string; name: string; phone: string; role: string; language: string; nationality: string | null; isSample: boolean; createdAt: string };

export default async function Users({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; role?: string }> }) {
  const { locale } = await params;
  const { q, role } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const page = await api<Page<U>>('/admin/users', { query: { q, role, limit: 100 } });
  return (
    <>
      <PageHeader title={t('nav.users')} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder={t('users.search')} className={`${inputCls} max-w-sm`} />
        <select name="role" defaultValue={role ?? ''} className={`${inputCls} w-auto`} aria-label={t('users.role')}>
          <option value="">{t('users.allRoles')}</option>
          {['pilgrim', 'provider_owner', 'staff', 'admin_ops', 'admin_finance', 'admin_support'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
        <button className="min-h-12 rounded-lg bg-brand-700 px-4 text-white">{t('users.go')}</button>
      </form>
      <Table head={[t('users.name'), t('users.phone'), t('users.role'), t('users.language'), t('users.joined')]} empty={t('none')}>
        {page.items.map((u) => (
          <tr key={u.id}>
            <Td>{u.name}{u.isSample && <span className="ms-2"><Badge tone="grey">{t('sample')}</Badge></span>}</Td>
            <Td><span dir="ltr">{u.phone}</span></Td>
            <Td>{t(`roles.${u.role}`)}</Td>
            <Td>{u.language.toUpperCase()}{u.nationality ? ` · ${u.nationality}` : ''}</Td>
            <Td>{day(u.createdAt, locale)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
