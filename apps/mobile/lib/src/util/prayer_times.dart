import 'dart:math' as math;

/// Prayer times computed on the phone (works offline), Umm al-Qura method:
/// Fajr at 18.5°, Isha 90 minutes after Maghrib (120 in Ramadan), Asr by shadow length 1.
/// Algorithm from praytimes.org; checked against published Makkah times.
class PrayerTimes {
  PrayerTimes({required this.fajr, required this.sunrise, required this.dhuhr, required this.asr, required this.maghrib, required this.isha});

  /// Local times (Saudi time, UTC+3) on the given date.
  final DateTime fajr, sunrise, dhuhr, asr, maghrib, isha;

  List<(String, DateTime)> get all => [('fajr', fajr), ('sunrise', sunrise), ('dhuhr', dhuhr), ('asr', asr), ('maghrib', maghrib), ('isha', isha)];

  /// Next prayer after [now] (Saudi time), skipping sunrise.
  (String, DateTime)? next(DateTime now) {
    for (final p in all) {
      if (p.$1 == 'sunrise') continue;
      if (p.$2.isAfter(now)) return p;
    }
    return null;
  }

  static PrayerTimes compute({required DateTime date, required double lat, required double lng, double timezone = 3, bool ramadan = false}) {
    final jd = _julian(date.year, date.month, date.day) - lng / (15 * 24);

    double midday(double t) => _fix(12 - _sun(jd + t).$2, 24);
    double angleTime(double angle, double t, {required bool beforeNoon}) {
      final decl = _sun(jd + t).$1;
      final noon = midday(t);
      final v = (-math.sin(angle * _d2r) - math.sin(decl * _d2r) * math.sin(lat * _d2r)) / (math.cos(decl * _d2r) * math.cos(lat * _d2r));
      final h = math.acos(v.clamp(-1.0, 1.0)) * _r2d / 15;
      return noon + (beforeNoon ? -h : h);
    }

    double asrTime(double t) {
      final decl = _sun(jd + t).$1;
      final a = -math.atan(1 / (1 + math.tan((lat - decl).abs() * _d2r))) * _r2d;
      return angleTime(a, t, beforeNoon: false);
    }

    double adj(double t) => t + timezone - lng / 15;
    DateTime at(double hours) {
      final minutes = (hours * 60).round();
      return DateTime(date.year, date.month, date.day).add(Duration(minutes: minutes));
    }

    final maghrib = adj(angleTime(0.833, 18 / 24, beforeNoon: false));
    return PrayerTimes(
      fajr: at(adj(angleTime(18.5, 5 / 24, beforeNoon: true))),
      sunrise: at(adj(angleTime(0.833, 6 / 24, beforeNoon: true))),
      dhuhr: at(adj(midday(12 / 24))),
      asr: at(adj(asrTime(13 / 24))),
      maghrib: at(maghrib),
      isha: at(maghrib + (ramadan ? 2 : 1.5)),
    );
  }

  static const _d2r = math.pi / 180;
  static const _r2d = 180 / math.pi;

  static double _fix(double a, double b) {
    final r = a - b * (a / b).floorToDouble();
    return r < 0 ? r + b : r;
  }

  /// Sun declination and equation of time for a Julian date.
  static (double, double) _sun(double jd) {
    final d = jd - 2451545.0;
    final g = _fix(357.529 + 0.98560028 * d, 360);
    final q = _fix(280.459 + 0.98564736 * d, 360);
    final l = _fix(q + 1.915 * math.sin(g * _d2r) + 0.020 * math.sin(2 * g * _d2r), 360);
    final e = 23.439 - 0.00000036 * d;
    final ra = _fix(math.atan2(math.cos(e * _d2r) * math.sin(l * _d2r), math.cos(l * _d2r)) * _r2d / 15, 24);
    final decl = math.asin(math.sin(e * _d2r) * math.sin(l * _d2r)) * _r2d;
    return (decl, q / 15 - ra);
  }

  static double _julian(int y, int m, int d) {
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    final a = (y / 100).floor();
    final b = 2 - a + (a / 4).floor();
    return (365.25 * (y + 4716)).floorToDouble() + (30.6001 * (m + 1)).floorToDouble() + d + b - 1524.5;
  }
}
