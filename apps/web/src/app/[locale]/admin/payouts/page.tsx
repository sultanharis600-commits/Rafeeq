import { getTranslations, setRequestLocale } from 'next-intl/server';
import { approvePayout, reconcile, runPayouts } from '@/app/actions/admin';
import { ActionButton, ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Field, inputCls, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { day, pick, sar, when } from '@/lib/format';
import type { Payout, Translated } from '@/lib/types';

type Run = { id: string; runAt: string; checked: number; mismatches: { kind: string; id: string; problem: string }[] };

export default async function Payouts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const p = await getTranslations('Provider');
  const s = await getTranslations('status');
  const [payouts, runs] = await Promise.all([
    api<{ payout: Payout; providerName: Translated }[]>('/admin/payouts'),
    api<Run[]>('/admin/reconciliation'),
  ]);
  const last = runs[0];
  return (
    <>
      <PageHeader title={t('nav.payouts')} subtitle={t('payouts.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={[t('provider'), p('earnings.period'), p('earnings.gross'), p('earnings.commission'), p('earnings.net'), p('common.status'), '']} empty={t('none')}>
            {payouts.map(({ payout: x, providerName }) => (
              <tr key={x.id}>
                <Td>{pick(providerName, locale)}<p className="text-sm text-ink-600">{t('payouts.lines', { n: x.lines.length })}</p></Td>
                <Td>{day(x.periodStart, locale)} – {day(x.periodEnd, locale)}</Td>
                <Td>{sar(x.grossHalalas, locale)}</Td>
                <Td>{sar(x.commissionHalalas, locale)}</Td>
                <Td className="font-semibold">{sar(x.netHalalas, locale)}</Td>
                <Td><Badge status={x.status}>{s(x.status)}</Badge></Td>
                <Td>{x.status === 'calculated' && <ActionButton action={approvePayout} hidden={{ id: x.id }} variant="secondary">{t('payouts.approve')}</ActionButton>}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="space-y-6">
          <Card title={t('payouts.run')}>
            <ActionForm action={runPayouts} successText={t('payouts.ran')}>
              <Field label={t('payouts.periodEnd')} hint={t('payouts.periodEndHint')}>
                <input type="date" name="periodEnd" className={inputCls} />
              </Field>
              <SubmitButton>{t('payouts.runButton')}</SubmitButton>
            </ActionForm>
          </Card>
          <Card title={t('recon.title')} actions={<ActionButton action={reconcile} variant="secondary">{t('recon.run')}</ActionButton>}>
            {last ? (
              <>
                <p>{t('recon.last', { time: when(last.runAt, locale), n: last.checked })}</p>
                {last.mismatches.length === 0 ? (
                  <p className="mt-2 text-brand-700">{t('recon.clean')}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-red-800">
                    {last.mismatches.map((m, i) => <li key={i}>{m.kind} <span className="font-mono">{m.id.slice(0, 8)}</span>: {m.problem}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-ink-600">{t('recon.never')}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
