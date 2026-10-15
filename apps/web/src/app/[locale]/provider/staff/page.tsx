import { getTranslations, setRequestLocale } from 'next-intl/server';
import { addStaff, removeStaff } from '@/app/actions/provider';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Field, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { requireProvider } from '@/lib/session';
import type { Staff } from '@/lib/types';

const ROLES = ['driver', 'guide', 'photographer', 'luggage', 'assistant'] as const;

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const staff = await api<Staff[]>(`/providers/${current.id}/staff`);
  return (
    <>
      <PageHeader title={t('nav.staff')} subtitle={t('staff.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={[t('staff.name'), t('staff.phone'), t('staff.role'), t('staff.vehicle'), '']} empty={t('staff.none')}>
            {staff.map((m) => (
              <tr key={m.id}>
                <Td>{m.name}{!m.active && <span className="ms-2"><Badge tone="grey">{t('staff.inactive')}</Badge></span>}</Td>
                <Td><span dir="ltr">{m.phone}</span></Td>
                <Td>{t(`staffRole.${m.staffRole}`)}</Td>
                <Td>{m.vehicle ?? '—'}</Td>
                <Td>
                  {m.active && (
                    <ActionButton action={removeStaff} hidden={{ providerId: current.id, staffId: m.id }} variant="secondary" confirm={t('staff.removeConfirm')}>
                      {t('staff.remove')}
                    </ActionButton>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title={t('staff.add')}>
          <ActionForm action={addStaff} hidden={{ providerId: current.id }} resetOnSuccess successText={t('staff.added')}>
            <Field label={t('staff.name')}><input name="name" required maxLength={80} className={inputCls} /></Field>
            <Field label={t('staff.phone')} hint={t('staff.phoneHint')}>
              <input name="phone" required dir="ltr" pattern="^\+[1-9]\d{7,14}$" placeholder="+9665XXXXXXXX" className={inputCls} />
            </Field>
            <Field label={t('staff.role')}>
              <select name="staffRole" required className={inputCls}>
                {ROLES.map((r) => <option key={r} value={r}>{t(`staffRole.${r}`)}</option>)}
              </select>
            </Field>
            <Field label={t('staff.vehicle')}><input name="vehicle" maxLength={120} className={inputCls} /></Field>
            <SubmitButton>{t('staff.add')}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
