'use client';

import { useTranslations } from 'next-intl';

/** Shown when a page fails to load (e.g. the API is down or the account lacks access). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('App');
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-brand-900">{t('error')}</h1>
      {error.digest && <p className="mt-2 font-mono text-sm text-ink-600">{error.digest}</p>}
      <button type="button" onClick={reset} className="mt-6 min-h-12 rounded-lg bg-brand-700 px-4 text-white">
        {t('retry')}
      </button>
    </main>
  );
}
