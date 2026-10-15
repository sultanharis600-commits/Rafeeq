import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../api/client.dart';
import '../api/offline_queue.dart';
import '../config.dart';
import '../session.dart';
import 'ble.dart';

/// A position the phone recorded, kept on the phone so "I'm lost" can send it even when
/// GPS can't get a fresh fix (indoors, in a crowd).
class LastFix {
  LastFix(this.lat, this.lng, this.accuracyM, this.at);
  final double lat;
  final double lng;
  final double? accuracyM;
  final DateTime at;

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng, 'accuracyM': accuracyM, 'at': at.toIso8601String()};
  static LastFix? fromJson(Map<String, dynamic>? j) =>
      j == null ? null : LastFix((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble(), (j['accuracyM'] as num?)?.toDouble(), DateTime.parse(j['at'] as String));
}

/// Last known location (guide: Lost Companion, part 2). While the pilgrim shares their
/// location with the group, the app records a point every few minutes and queues it;
/// the queue uploads when data returns, keeping the time each point was recorded.
///
/// MVP limit: points are recorded while the app is open or in recent apps. Recording with
/// the app fully closed needs the platform background-location setup (see apps/mobile/README.md).
class LocationService {
  LocationService(this._ref);
  final Ref _ref;
  Timer? _timer;
  bool _started = false;

  static const _lastKey = 'last_fix';

  LastFix? get lastFix {
    final raw = _ref.read(prefsProvider).getString(_lastKey);
    return raw == null ? null : LastFix.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
  }

  Future<void> start() async {
    if (_started) return;
    final me = _ref.read(sessionProvider).me;
    if (me == null || !me.isPilgrim) return;
    _started = true;
    // The Bluetooth finder works without any network: advertise today's ID.
    unawaited(_ref.read(bleProvider).startAdvertising());
    if (!me.sharesLocation) return;
    if (!await ensurePermission()) return;
    await _record();
    _timer = Timer.periodic(Config.locationInterval, (_) => _record());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _started = false;
  }

  /// Ask for location permission (once). Returns false if the user said no.
  static Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    return p == LocationPermission.always || p == LocationPermission.whileInUse;
  }

  /// A fresh fix if possible within [timeout], else the last stored one.
  Future<LastFix?> currentOrLast({Duration timeout = const Duration(seconds: 10)}) async {
    try {
      if (await ensurePermission()) {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeout),
        );
        final fix = LastFix(pos.latitude, pos.longitude, pos.accuracy, DateTime.now());
        await _store(fix);
        return fix;
      }
    } catch (_) {
      // No fix in time (indoors, crowd): fall back below.
    }
    try {
      final known = await Geolocator.getLastKnownPosition();
      if (known != null) return LastFix(known.latitude, known.longitude, known.accuracy, known.timestamp);
    } catch (_) {}
    return lastFix;
  }

  Future<void> _store(LastFix fix) => _ref.read(prefsProvider).setString(_lastKey, jsonEncode(fix.toJson()));

  Future<void> _record() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
      );
      final now = DateTime.now();
      final fix = LastFix(pos.latitude, pos.longitude, pos.accuracy, now);
      await _store(fix);
      await _ref.read(offlineQueueProvider.notifier).add(QueuedAction(
            id: 'loc-${now.microsecondsSinceEpoch}-${Random().nextInt(1 << 20)}',
            kind: 'location',
            at: now,
            body: {'lat': fix.lat, 'lng': fix.lng, 'accuracyM': fix.accuracyM, 'recordedAt': now.toUtc().toIso8601String(), 'source': 'gps'},
          ));
    } catch (_) {
      // No fix this time; try again next interval.
    }
  }
}

final locationServiceProvider = Provider<LocationService>((ref) {
  final s = LocationService(ref);
  ref.onDispose(s.stop);
  return s;
});
