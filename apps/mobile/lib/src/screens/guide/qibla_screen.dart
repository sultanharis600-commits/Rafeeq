import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_compass/flutter_compass.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../lost/location_service.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/geo.dart';
import '../../widgets/common.dart';

/// Qibla direction from the phone's location (or the hotel), using the compass.
/// Near the Haram the Kaaba is close by, so the screen also shows the distance.
class QiblaScreen extends ConsumerStatefulWidget {
  const QiblaScreen({super.key});

  @override
  ConsumerState<QiblaScreen> createState() => _QiblaScreenState();
}

class _QiblaScreenState extends ConsumerState<QiblaScreen> {
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    final hotel = ref.read(sessionProvider).me?.hotel;
    _lat = (hotel?['lat'] as num?)?.toDouble();
    _lng = (hotel?['lng'] as num?)?.toDouble();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final fix = await ref.read(locationServiceProvider).currentOrLast(timeout: const Duration(seconds: 6));
      if (fix != null && mounted) {
        setState(() {
          _lat = fix.lat;
          _lng = fix.lng;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    if (_lat == null || _lng == null) {
      return Scaffold(appBar: AppBar(title: Text(t.qibla)), body: Center(child: Text(t.qiblaNeedsLocation)));
    }
    final qibla = qiblaBearing(_lat!, _lng!);
    final distanceKm = distanceM(_lat!, _lng!, kaabaLat, kaabaLng) / 1000;

    return Scaffold(
      appBar: AppBar(title: Text(t.qibla)),
      body: StreamBuilder<CompassEvent>(
        stream: FlutterCompass.events,
        builder: (context, snap) {
          final heading = snap.data?.heading;
          final noCompass = FlutterCompass.events == null || (snap.hasData && heading == null);
          // Arrow angle on screen: Qibla bearing minus where the phone is pointing.
          final angle = heading == null ? qibla : qibla - heading;
          final norm = ((angle % 360) + 360) % 360;
          final aligned = heading != null && (norm < 5 || norm > 355);
          return Center(
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Semantics(
                label: t.qiblaBearing(qibla.round()),
                child: Transform.rotate(
                  angle: angle * math.pi / 180,
                  child: Icon(Icons.navigation, size: 220, color: aligned ? RafeeqColors.brand700 : RafeeqColors.gold500),
                ),
              ),
              const SizedBox(height: 24),
              Text(t.qiblaBearing(qibla.round()), style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(distanceKm < 1 ? t.kaabaMetres((distanceKm * 1000).round()) : t.kaabaKm(distanceKm.round())),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(noCompass ? t.noCompass : t.qiblaHint, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
              ),
            ]),
          );
        },
      ),
    );
  }
}
