'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icons';
import { buttonCls } from '@/components/ui';

/** Shown when a page fails to load (e.g. the API is down or the account lacks access). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('App');
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-3xl border border-sand-200 bg-white p-8 text-center shadow-lift">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-clay-100 text-clay-700">
          <Icon name="alert" className="size-8" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-bold text-brand-900">{t('error')}</h1>
        {error.digest && <p className="mt-2 font-mono text-sm text-ink-600">{error.digest}</p>}
        <button type="button" onClick={reset} className={`mt-6 inline-flex min-h-12 items-center rounded-xl px-6 font-semibold ${buttonCls.primary}`}>
          {t('retry')}
        </button>
      </div>
    </main>
  );
}
