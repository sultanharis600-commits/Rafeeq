import type { Language, Translated } from '@rafeeq/shared';

/**
 * Push and SMS texts in the six launch languages. {placeholders} are filled from params.
 * Drafts: a native speaker approves each language before launch (AI_RULES.md).
 * SMS texts stay short (one SMS segment where possible).
 */
type T = Record<Language, string>;

export const TEMPLATES = {
  'auth.otp': {
    en: 'Rafeeq code: {code}. Do not share it.',
    ar: 'رمز رفيق: {code}. لا تشاركه مع أحد.',
    ur: 'رفیق کوڈ: {code}۔ کسی کو نہ بتائیں۔',
    id: 'Kode Rafeeq: {code}. Jangan dibagikan.',
    ms: 'Kod Rafeeq: {code}. Jangan kongsi.',
    tr: 'Rafeeq kodu: {code}. Kimseyle paylaşmayın.',
  },
  'booking.paid_provider': {
    en: 'New booking: {service} on {when}. Accept it in your dashboard.',
    ar: 'حجز جديد: {service} في {when}. اقبله من لوحتك.',
    ur: 'نئی بکنگ: {service}، {when}۔ ڈیش بورڈ میں قبول کریں۔',
    id: 'Pesanan baru: {service} pada {when}. Terima di dasbor Anda.',
    ms: 'Tempahan baharu: {service} pada {when}. Terima di papan pemuka.',
    tr: 'Yeni rezervasyon: {service}, {when}. Panelinizden onaylayın.',
  },
  'booking.accepted': {
    en: '{provider} accepted your booking for {service}.',
    ar: 'قبل {provider} حجزك لخدمة {service}.',
    ur: '{provider} نے {service} کی آپ کی بکنگ قبول کر لی۔',
    id: '{provider} menerima pesanan Anda untuk {service}.',
    ms: '{provider} menerima tempahan anda untuk {service}.',
    tr: '{provider}, {service} rezervasyonunuzu onayladı.',
  },
  'booking.declined': {
    en: '{provider} could not take your booking. Your payment will be refunded in full.',
    ar: 'لم يتمكن {provider} من قبول حجزك. سيُعاد المبلغ كاملاً.',
    ur: '{provider} آپ کی بکنگ نہیں لے سکا۔ پوری رقم واپس ہوگی۔',
    id: '{provider} tidak dapat menerima pesanan Anda. Pembayaran dikembalikan penuh.',
    ms: '{provider} tidak dapat menerima tempahan anda. Bayaran dipulangkan sepenuhnya.',
    tr: '{provider} rezervasyonunuzu alamadı. Ödemeniz tamamen iade edilecek.',
  },
  'booking.staff_assigned': {
    en: '{staff} will look after your {service}.',
    ar: 'سيتولى {staff} خدمة {service} الخاصة بك.',
    ur: '{staff} آپ کی {service} سنبھالیں گے۔',
    id: '{staff} akan menangani {service} Anda.',
    ms: '{staff} akan menguruskan {service} anda.',
    tr: '{staff}, {service} hizmetinizle ilgilenecek.',
  },
  'booking.started': {
    en: 'Your {service} has started. Follow it live in Rafeeq.',
    ar: 'بدأت خدمة {service}. تابعها مباشرة في رفيق.',
    ur: 'آپ کی {service} شروع ہو گئی۔ رفیق میں لائیو دیکھیں۔',
    id: '{service} Anda sudah dimulai. Pantau langsung di Rafeeq.',
    ms: '{service} anda telah bermula. Ikuti secara langsung di Rafeeq.',
    tr: '{service} başladı. Rafeeq\'te canlı takip edin.',
  },
  'booking.completed': {
    en: 'Your {service} is complete. How was it? Leave a review.',
    ar: 'اكتملت خدمة {service}. كيف كانت؟ اترك تقييماً.',
    ur: 'آپ کی {service} مکمل ہو گئی۔ کیسی رہی؟ جائزہ دیں۔',
    id: '{service} Anda selesai. Bagaimana? Beri ulasan.',
    ms: '{service} anda selesai. Bagaimana? Beri ulasan.',
    tr: '{service} tamamlandı. Nasıldı? Yorum bırakın.',
  },
  'booking.refunded': {
    en: 'Refund of {amount} SAR sent to your original payment method.',
    ar: 'أُعيد مبلغ {amount} ريال إلى وسيلة الدفع الأصلية.',
    ur: '{amount} ریال کی واپسی آپ کے اصل ادائیگی کے طریقے پر بھیج دی گئی۔',
    id: 'Pengembalian {amount} SAR dikirim ke metode pembayaran awal.',
    ms: 'Bayaran balik {amount} SAR dihantar ke kaedah bayaran asal.',
    tr: '{amount} SAR iade, ödeme yönteminize gönderildi.',
  },
  'bag.scanned': {
    en: 'Bag "{bag}": {place} at {time}.',
    ar: 'الحقيبة "{bag}": {place} الساعة {time}.',
    ur: 'بیگ "{bag}": {place}، {time}۔',
    id: 'Koper "{bag}": {place} pukul {time}.',
    ms: 'Beg "{bag}": {place} pada {time}.',
    tr: 'Bavul "{bag}": {place}, saat {time}.',
  },
  'bag.case_opened': {
    en: 'We could not confirm where bag "{bag}" is. Bidec support and the provider are checking now.',
    ar: 'لم نتمكن من تأكيد مكان الحقيبة "{bag}". فريق بايدك ومقدم الخدمة يتحققان الآن.',
    ur: 'ہم بیگ "{bag}" کی جگہ کی تصدیق نہیں کر سکے۔ بائیڈک سپورٹ اور فراہم کنندہ جانچ رہے ہیں۔',
    id: 'Kami belum bisa memastikan lokasi koper "{bag}". Tim Bidec dan penyedia sedang memeriksa.',
    ms: 'Kami belum dapat mengesahkan lokasi beg "{bag}". Sokongan Bidec dan penyedia sedang menyemak.',
    tr: '"{bag}" bavulunun yerini doğrulayamadık. Bidec destek ve sağlayıcı kontrol ediyor.',
  },
  'order.status': {
    en: 'Your order from {shop} is now: {status}.',
    ar: 'طلبك من {shop} الآن: {status}.',
    ur: '{shop} سے آپ کا آرڈر اب: {status}۔',
    id: 'Pesanan Anda dari {shop} sekarang: {status}.',
    ms: 'Pesanan anda dari {shop} kini: {status}.',
    tr: '{shop} siparişiniz: {status}.',
  },
  'order.paid_shop': {
    en: 'New order {ref}: {items} item(s). Pack it in your dashboard.',
    ar: 'طلب جديد {ref}: {items} قطعة. جهّزه من لوحتك.',
    ur: 'نیا آرڈر {ref}: {items} اشیاء۔ ڈیش بورڈ میں پیک کریں۔',
    id: 'Pesanan baru {ref}: {items} barang. Kemas di dasbor Anda.',
    ms: 'Pesanan baharu {ref}: {items} item. Bungkus di papan pemuka.',
    tr: 'Yeni sipariş {ref}: {items} ürün. Panelinizden hazırlayın.',
  },
  'lost.alert': {
    en: 'RAFEEQ: {name} pressed "I\'m lost". Last location: {map}',
    ar: 'رفيق: ضغط {name} زر "أنا تائه". آخر موقع: {map}',
    ur: 'رفیق: {name} نے "میں گم ہوں" دبایا۔ آخری مقام: {map}',
    id: 'RAFEEQ: {name} menekan "Saya tersesat". Lokasi terakhir: {map}',
    ms: 'RAFEEQ: {name} menekan "Saya sesat". Lokasi terakhir: {map}',
    tr: 'RAFEEQ: {name} "Kayboldum" dedi. Son konum: {map}',
  },
  'lost.resolved': {
    en: '{name} is safe. The alert is closed.',
    ar: '{name} بخير. أُغلق التنبيه.',
    ur: '{name} محفوظ ہیں۔ الرٹ بند کر دیا گیا۔',
    id: '{name} sudah aman. Peringatan ditutup.',
    ms: '{name} selamat. Amaran ditutup.',
    tr: '{name} güvende. Uyarı kapatıldı.',
  },
} satisfies Record<string, T>;

export type TemplateKey = keyof typeof TEMPLATES;

/** Param values: plain text, numbers, translated text (picked per recipient), or a Date (shown in Saudi time). */
export type Param = string | number | Translated | Date;
export type Params = Record<string, Param>;

const LOCALE: Record<Language, string> = { en: 'en-GB', ar: 'ar-SA', ur: 'ur-PK', id: 'id-ID', ms: 'ms-MY', tr: 'tr-TR' };

function value(v: Param, lang: Language): string {
  if (v instanceof Date) {
    return new Intl.DateTimeFormat(LOCALE[lang], {
      timeZone: 'Asia/Riyadh',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(v);
  }
  if (typeof v === 'object') return (v as Record<string, string | undefined>)[lang] ?? v.en;
  return String(v);
}

export function render(key: TemplateKey, lang: Language, params: Params): string {
  const text = TEMPLATES[key][lang] ?? TEMPLATES[key].en;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? value(params[k], lang) : `{${k}}`));
}
