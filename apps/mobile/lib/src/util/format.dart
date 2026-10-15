import 'package:intl/intl.dart';

/// Money is integer halalas; times are UTC and shown in Saudi time (UTC+3, no DST).
abstract final class Fmt {
  static const saudiOffset = Duration(hours: 3);

  static String sar(int halalas, String locale) {
    final f = NumberFormat.currency(locale: _intl(locale), symbol: locale == 'ar' ? 'ر.س' : 'SAR ', decimalDigits: 2);
    return f.format(halalas / 100);
  }

  static DateTime saudi(DateTime utc) => utc.toUtc().add(saudiOffset);

  static String dateTime(String? iso, String locale) {
    if (iso == null) return '—';
    final t = saudi(DateTime.parse(iso));
    return DateFormat.MMMEd(_intl(locale)).add_Hm().format(t);
  }

  static String time(String? iso, String locale) {
    if (iso == null) return '—';
    return DateFormat.Hm(_intl(locale)).format(saudi(DateTime.parse(iso)));
  }

  static String day(DateTime saudiDate, String locale) => DateFormat.yMMMEd(_intl(locale)).format(saudiDate);

  static String hm(DateTime saudiTime, String locale) => DateFormat.Hm(_intl(locale)).format(saudiTime);

  /// Locale names intl knows (Malay is "ms", Indonesian "id").
  static String _intl(String l) => const {'ar': 'ar', 'en': 'en', 'ur': 'ur', 'id': 'id', 'ms': 'ms', 'tr': 'tr'}[l] ?? 'en';
}

/// Pick the reader's language from a translated JSON object, falling back to English.
String pick(Object? translated, String lang) {
  if (translated is String) return translated;
  if (translated is Map) return (translated[lang] ?? translated['en'] ?? '') as String;
  return '';
}
