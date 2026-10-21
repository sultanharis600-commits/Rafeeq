import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Icon, Logo } from '@/components/icons';
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
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-khatim relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <Logo className="size-14 drop-shadow-[0_6px_14px_rgb(0_0_0/0.3)]" />
          <h1 className="font-display text-3xl font-bold">{app('name')}</h1>
        </div>
        <div className="relative z-10 mt-8 mb-6 max-w-md lg:my-12">
          <p className="font-display text-3xl leading-snug font-bold text-gold-300 lg:text-5xl lg:leading-tight">{app('tagline')}</p>
          <p className="mt-6 flex items-center gap-2 text-white/80 lg:mt-8">
            <Icon name="info" className="size-5 text-gold-300" />
            {t('pilgrimsUseApp')}
          </p>
        </div>
        <ArchSkyline />
        <div className="sadu-band absolute inset-x-0 bottom-0" aria-hidden="true" />
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <p role="status" className="flex items-start gap-3 rounded-xl border border-s-4 border-gold-500/40 bg-gold-500/10 px-4 py-3">
            <Icon name="info" className="mt-0.5 size-5 text-gold-700" />
            {app('demoBanner')}
          </p>
          {expired && <p className="mt-4 rounded-lg bg-clay-100 px-3 py-2 font-medium text-clay-700">{t('expired')}</p>}
          <div className="mt-6 rounded-3xl border border-sand-200 bg-white p-8 shadow-lift">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name="user" className="size-6" />
              </span>
              <h2 className="font-display text-2xl font-bold text-brand-900">{t('title')}</h2>
            </div>
            <LoginForm locale={locale} quick={quick} />
          </div>
        </div>
      </section>
    </main>
  );
}

/** Decorative skyline of Najdi arches and a minaret, in gold line work. */
function ArchSkyline() {
  return (
    <svg viewBox="0 0 400 140" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2 hidden w-full opacity-25 lg:block">
      <g fill="none" stroke="#F7D54D" strokeWidth="1.5">
        <path d="M0 140V96h40v44M8 140v-22a12 12 0 0 1 24 0v22" />
        <path d="M48 140V78h70v62M60 140v-30a23 23 0 0 1 46 0v30" />
        <path d="M126 140V20l8-12 8 12v120M128 40h12M128 70h12" />
        <path d="M150 140V64q35-34 70 0v76M166 140v-28a19 19 0 0 1 38 0v28" />
        <path d="M228 140V88h56v52M238 140v-20a18 18 0 0 1 36 0v20" />
        <path d="M292 140V70h60v70M304 140v-26a18 18 0 0 1 36 0v26M292 70l6-8h48l6 8" />
        <path d="M360 140v-36h40v36M370 140v-16a10 10 0 0 1 20 0v16" />
      </g>
    </svg>
  );
}
