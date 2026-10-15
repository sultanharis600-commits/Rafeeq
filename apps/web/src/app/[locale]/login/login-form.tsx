'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { quickLogin, requestCode, verifyCode } from '@/app/actions/auth';
import { ErrorText, SubmitButton } from '@/components/forms';
import { inputCls } from '@/components/ui';

export function LoginForm({ locale, quick }: { locale: string; quick: boolean }) {
  return quick ? <QuickLoginForm locale={locale} /> : <CodeLoginForm locale={locale} />;
}

/** Testing only: one field, phone number or email, no code. */
function QuickLoginForm({ locale }: { locale: string }) {
  const t = useTranslations('Login');
  const [state, login] = useActionState(quickLogin, null);
  return (
    <form action={login} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="mb-1 block font-medium">{t('identifier')}</span>
        <input name="identifier" dir="ltr" required autoFocus placeholder="+966500000001 · admin-ops@rafeeq.test" className={inputCls} autoComplete="username" />
        <span className="mt-1 block text-sm text-ink-600">{t('quickHint')}</span>
      </label>
      <ErrorText state={state} />
      <SubmitButton>{t('login')}</SubmitButton>
    </form>
  );
}

function CodeLoginForm({ locale }: { locale: string }) {
  const t = useTranslations('Login');
  const [sent, send] = useActionState(requestCode, null);
  const [verified, verify] = useActionState(verifyCode, null);
  const data = (sent?.ok ? sent.data : null) as { phone: string; demoCode?: string } | null;

  if (!data) {
    return (
      <form action={send} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-medium">{t('phone')}</span>
          <input name="phone" type="tel" dir="ltr" required placeholder="+9665XXXXXXXX" pattern="^\+[1-9]\d{7,14}$" className={inputCls} autoComplete="tel" />
          <span className="mt-1 block text-sm text-ink-600">{t('phoneHint')}</span>
        </label>
        <ErrorText state={sent} />
        <SubmitButton>{t('sendCode')}</SubmitButton>
      </form>
    );
  }
  return (
    <form action={verify} className="space-y-4">
      <input type="hidden" name="phone" value={data.phone} />
      <input type="hidden" name="locale" value={locale} />
      <p>{t('codeSent', { phone: data.phone })}</p>
      {data.demoCode && <p className="rounded-lg bg-gold-500/15 px-3 py-2">{t('demoCode', { code: data.demoCode })}</p>}
      <label className="block">
        <span className="mb-1 block font-medium">{t('code')}</span>
        <input name="code" inputMode="numeric" dir="ltr" required pattern="\d{6}" maxLength={6} className={inputCls} autoComplete="one-time-code" />
      </label>
      <ErrorText state={verified} />
      <SubmitButton>{t('login')}</SubmitButton>
    </form>
  );
}
