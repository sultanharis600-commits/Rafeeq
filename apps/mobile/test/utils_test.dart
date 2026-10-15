import 'package:flutter_test/flutter_test.dart';
import 'package:rafeeq/src/util/format.dart';
import 'package:rafeeq/src/util/geo.dart';
import 'package:rafeeq/src/util/prayer_times.dart';

void main() {
  group('Qibla and distance', () {
    test('Qibla from Jakarta is about 295°', () {
      expect(qiblaBearing(-6.2088, 106.8456), closeTo(295.1, 1));
    });
    test('Qibla from London is about 119°', () {
      expect(qiblaBearing(51.5074, -0.1278), closeTo(119.0, 1));
    });
    test('Haram to Prophet\'s Mosque is about 337 km', () {
      expect(distanceM(21.4225, 39.8262, 24.4672, 39.6111) / 1000, closeTo(337, 5));
    });
  });

  group('lost SMS', () {
    test('has a readable line and a line the Rafeeq number can parse', () {
      final sms = lostSms(name: 'Siti', lat: 21.42123, lng: 39.82567, accuracyM: 24.6, template: '%name% is lost: %map%');
      final lines = sms.split('\n');
      expect(lines[0], 'Siti is lost: https://maps.google.com/?q=21.42123,39.82567');
      expect(lines[1], 'RFQ LOST 21.42123,39.82567 25');
    });
    test('still sends without a location', () {
      expect(lostSms(name: 'Siti', template: '%name% %map%'), 'Siti —\nRFQ LOST');
    });
  });

  group('prayer times (Umm al-Qura) for Makkah', () {
    final t = PrayerTimes.compute(date: DateTime(2026, 10, 13), lat: 21.4225, lng: 39.8262);
    test('come in order', () {
      final all = t.all.map((p) => p.$2).toList();
      for (var i = 1; i < all.length; i++) {
        expect(all[i].isAfter(all[i - 1]), isTrue, reason: t.all[i].$1);
      }
    });
    test('are in plausible windows', () {
      int minutes(DateTime d) => d.hour * 60 + d.minute;
      expect(minutes(t.dhuhr), inInclusiveRange(11 * 60 + 45, 12 * 60 + 15));
      expect(minutes(t.maghrib), inInclusiveRange(17 * 60 + 40, 18 * 60 + 20));
      expect(minutes(t.fajr), inInclusiveRange(4 * 60 + 40, 5 * 60 + 20));
      expect(t.isha.difference(t.maghrib).inMinutes, 90);
    });
    test('next prayer skips sunrise', () {
      final afterFajr = t.fajr.add(const Duration(minutes: 1));
      expect(t.next(afterFajr)!.$1, 'dhuhr');
    });
  });

  group('formatting', () {
    test('pick falls back to English', () {
      expect(pick({'en': 'Gate', 'ar': 'باب'}, 'ar'), 'باب');
      expect(pick({'en': 'Gate'}, 'tr'), 'Gate');
      expect(pick('plain', 'ar'), 'plain');
    });
    test('Saudi time is UTC+3', () {
      expect(Fmt.saudi(DateTime.utc(2026, 10, 13, 21, 30)).hour, 0);
    });
  });
}
