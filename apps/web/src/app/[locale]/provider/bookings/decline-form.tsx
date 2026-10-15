'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { declineBooking } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { inputCls } from '@/components/ui';

/** Decline needs a reason; the pilgrim gets a full refund and other options. */
export function DeclineForm({ id }: { id: string }) {
  const t = useTranslations('Provider.bookings');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-lg border border-red-700 px-4 text-red-700 hover:bg-red-50">
        {t('decline')}
      </button>
    );
  }
  return (
    <ActionForm action={declineBooking} hidden={{ id }} className="flex flex-wrap items-start gap-2">
      <input name="reason" required maxLength={500} placeholder={t('declineReason')} className={`${inputCls} max-w-xs`} />
      <SubmitButton variant="danger">{t('confirmDecline')}</SubmitButton>
    </ActionForm>
  );
}
