import { getTranslations, setRequestLocale } from 'next-intl/server';
import QRCode from 'qrcode';
import { PrintButton } from './print-button';
import { api } from '@/lib/api';

/** A4 sheet of QR bag tags (3 × 8). Each tag holds only its random code, never personal data. */
export default async function TagSheet({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin.bags');
  const tags = await api<{ tagCode: string }[]>('/admin/bag-tags');
  const svgs = await Promise.all(tags.slice(0, 96).map(async (x) => ({ code: x.tagCode, svg: await QRCode.toString(x.tagCode, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) })));
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-ink-600">{t('sheetHint', { n: svgs.length })}</p>
        <PrintButton label={t('print')} />
      </div>
      {svgs.length === 0 && <p>{t('noTags')}</p>}
      <div className="grid grid-cols-3 gap-3 bg-white print:gap-2" dir="ltr">
        {svgs.map((x) => (
          <div key={x.code} className="flex items-center gap-3 rounded-lg border border-dashed border-ink-600 p-3 break-inside-avoid">
            <div className="size-20 shrink-0" dangerouslySetInnerHTML={{ __html: x.svg }} />
            <div>
              <p className="text-sm font-semibold text-brand-900">Rafeeq · رفيق</p>
              <p className="font-mono text-lg">{x.code}</p>
              <p className="text-xs text-ink-600">{t('tagLineEn')}</p>
              <p className="text-xs text-ink-600" dir="rtl" lang="ar">{t('tagLineAr')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
