import { getTranslations } from 'next-intl/server';
import { isPast, when } from '@/lib/format';
import type { BagTimeline } from '@/lib/types';
import { Badge, Card } from './ui';

/** Chain of custody: every handover with who held the bag and when. */
export async function BagTimelineView({ bag, locale }: { bag: BagTimeline; locale: string }) {
  const t = await getTranslations('Bags');
  const s = await getTranslations('status');
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title={t('timeline')} className="lg:col-span-2">
        <ol className="relative space-y-4 border-s-2 border-brand-100 ps-6">
          {bag.scans.map((sc) => (
            <li key={sc.id} className={`relative ${sc.corrected ? 'opacity-50' : ''}`}>
              <span className="absolute -start-[33px] top-1 size-4 rounded-full border-2 border-white bg-brand-700" aria-hidden />
              <p className="font-medium">
                {t(`place.${sc.place}`)}
                {sc.isCorrection && <span className="ms-2"><Badge tone="gold">{t('correction')}</Badge></span>}
                {sc.corrected && <span className="ms-2 text-sm">({t('corrected')})</span>}
              </p>
              <p className="text-ink-600">
                {when(sc.scannedAt, locale)} · {t('heldBy', { name: sc.heldBy })}
                {sc.syncedLate && <span className="ms-2 text-sm">{t('syncedLate')}</span>}
              </p>
            </li>
          ))}
        </ol>
        {bag.expectedNextScanBy && (
          <p className={`mt-4 ${isPast(bag.expectedNextScanBy) ? 'font-semibold text-red-700' : 'text-ink-600'}`}>
            {t('nextScanBy', { time: when(bag.expectedNextScanBy, locale, { timeStyle: 'short' }) })}
          </p>
        )}
      </Card>
      <Card title={t('cases')}>
        {bag.cases.length === 0 ? (
          <p className="text-ink-600">{t('noCases')}</p>
        ) : (
          <ul className="space-y-3">
            {bag.cases.map((c) => (
              <li key={c.id}>
                <Badge status={c.status}>{s(c.status)}</Badge> <span className="ms-1">{t(`reason.${c.reason}`)}</span>
                <p className="text-sm text-ink-600">{when(c.openedAt, locale)}{c.resolvedAt ? ` → ${when(c.resolvedAt, locale)}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
