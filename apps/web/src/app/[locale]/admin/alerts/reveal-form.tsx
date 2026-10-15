'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { revealLocation } from '@/app/actions/admin';
import { ErrorText, SubmitButton } from '@/components/forms';
import { inputCls } from '@/components/ui';

type Result = { person: { name: string; phone: string }; alertLocation: { lat: number; lng: number } | null; lastKnown: { lat: number; lng: number; recordedAt: string; source: string } | null };

export function RevealForm({ id }: { id: string }) {
  const t = useTranslations('Admin.alerts');
  const [state, action] = useActionState(revealLocation, null);
  const r = state?.ok ? (state.data as Result) : null;
  if (r) {
    const p = r.lastKnown ?? r.alertLocation;
    return (
      <div>
        <p className="font-medium">{r.person.name} · <span dir="ltr">{r.person.phone}</span></p>
        {p ? (
          <a className="text-brand-700 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`}>
            {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
          </a>
        ) : (
          <p>{t('noLocation')}</p>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="reason" required minLength={10} placeholder={t('reason')} className={`${inputCls} min-w-48`} />
      <SubmitButton variant="secondary">{t('reveal')}</SubmitButton>
      <ErrorText state={state} />
    </form>
  );
}
