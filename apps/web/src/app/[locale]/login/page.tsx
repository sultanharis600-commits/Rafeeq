import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { LoginForm } from './login-form';

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ expired?: string }> }) {
  const { locale } = await params;
  const { expired } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Login');
  const app = await getTranslations('App');
  let quick = false;
  try {
    quick = (await api<{ quickLogin?: boolean }>('/config', { auth: false })).quickLogin === true;
  } catch {
    // API down: show the normal code login; it will report the error on submit.
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-4xl font-semibold text-brand-900">{app('name')}</h1>
      <p className="mt-2 text-lg text-ink-600">{app('tagline')}</p>
      <p role="status" className="mt-6 rounded-lg bg-gold-500/15 px-4 py-3">
        {app('demoBanner')}
      </p>
      {expired && <p className="mt-4 text-red-700">{t('expired')}</p>}
      <div className="mt-6 rounded-xl border border-sand-300 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">{t('title')}</h2>
        <LoginForm locale={locale} quick={quick} />
      </div>
      <p className="mt-6 text-sm text-ink-600">{t('pilgrimsUseApp')}</p>
    </main>
  );
}
