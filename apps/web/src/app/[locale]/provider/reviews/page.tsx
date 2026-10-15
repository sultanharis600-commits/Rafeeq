import { getTranslations, setRequestLocale } from 'next-intl/server';
import { replyReview } from '@/app/actions/provider';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card, inputCls, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { day, pick } from '@/lib/format';
import { requireProvider } from '@/lib/session';
import type { Review } from '@/lib/types';

export default async function Reviews({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { current } = await requireProvider(locale);
  if (!current) return null;
  const t = await getTranslations('Provider');
  const l = await getTranslations('languages');
  const rows = await api<Review[]>('/provider/reviews', { query: { providerId: current.id } });
  const avg = rows.length ? (rows.reduce((s, r) => s + r.review.rating, 0) / rows.length).toFixed(1) : '—';
  return (
    <>
      <PageHeader title={t('nav.reviews')} subtitle={t('reviews.summary', { avg, n: rows.length })} />
      <div className="space-y-4">
        {rows.length === 0 && <p className="text-ink-600">{t('reviews.none')}</p>}
        {rows.map((r) => (
          <Card key={r.review.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                <span aria-label={t('reviews.stars', { n: r.review.rating })} className="text-gold-500">{'★'.repeat(r.review.rating)}{'☆'.repeat(5 - r.review.rating)}</span>
                <span className="ms-2">{r.author.split(' ')[0]}</span>
              </p>
              <p className="text-sm text-ink-600">{r.serviceTitle ? pick(r.serviceTitle, locale) : t('reviews.shop')} · {day(r.review.createdAt, locale)}</p>
            </div>
            {r.review.text && (
              <p className="mt-2" lang={r.review.language} dir={['ar', 'ur'].includes(r.review.language) ? 'rtl' : 'ltr'}>
                {r.review.text}
                <span className="ms-2 text-sm text-ink-600">({l(r.review.language)})</span>
              </p>
            )}
            {r.review.reply ? (
              <p className="mt-3 rounded-lg bg-brand-100 p-3">{t('reviews.yourReply')}: {r.review.reply}</p>
            ) : (
              <ActionForm action={replyReview} hidden={{ id: r.review.id }} className="mt-3 flex flex-wrap gap-2">
                <input name="text" required maxLength={1000} placeholder={t('reviews.replyPlaceholder')} className={`${inputCls} flex-1`} />
                <SubmitButton variant="secondary">{t('reviews.reply')}</SubmitButton>
              </ActionForm>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
