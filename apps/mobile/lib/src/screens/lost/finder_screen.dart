import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:vibration/vibration.dart';

import '../../data.dart';
import '../../lost/ble.dart';
import '../../theme.dart';
import '../../util/geo.dart';
import '../../widgets/common.dart';

/// Bluetooth nearby finder: warmer / colder towards a group member's phone, with no
/// network at all. Signal strength is smoothed; the phone buzzes when getting closer.
class FinderScreen extends ConsumerStatefulWidget {
  const FinderScreen({super.key, required this.userId});
  final String userId;

  @override
  ConsumerState<FinderScreen> createState() => _FinderScreenState();
}

enum _Trend { none, warmer, colder, same }

class _FinderScreenState extends ConsumerState<FinderScreen> {
  StreamSubscription<int>? _sub;
  double? _smoothed; // RSSI, exponentially smoothed
  double? _previous;
  _Trend _trend = _Trend.none;
  DateTime? _lastSeen;
  String? _error;
  Timer? _tick;
  Json? _member;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
    _tick = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _start() async {
    // Group data (with the member's Bluetooth IDs) comes from the phone's cache if offline.
    try {
      final groups = await ref.read(groupsProvider.future);
      for (final g in groups.data) {
        for (final m in asList(g['members'])) {
          if (m['userId'] == widget.userId) _member = m;
        }
      }
    } catch (_) {}
    if (_member == null) {
      setState(() => _error = 'member');
      return;
    }
    final statuses = await [Permission.bluetoothScan, Permission.bluetoothConnect, Permission.locationWhenInUse].request();
    if (statuses.values.any((s) => s.isPermanentlyDenied)) {
      setState(() => _error = 'permission');
      return;
    }
    final ids = asList(_member!['bleIds']).map((e) => e['id'] as String).toList();
    _sub = ref.read(bleProvider).scanFor(ids).listen(_onRssi, onError: (_) {
      if (mounted) setState(() => _error = 'bluetooth');
    });
    setState(() {});
  }

  void _onRssi(int rssi) {
    final s = _smoothed == null ? rssi.toDouble() : _smoothed! * 0.7 + rssi * 0.3;
    _Trend trend = _trend;
    if (_previous != null) {
      final d = s - _previous!;
      trend = d > 2 ? _Trend.warmer : (d < -2 ? _Trend.colder : _Trend.same);
      if (trend != _Trend.same) _previous = s;
      if (trend == _Trend.warmer) Vibration.vibrate(duration: 120);
    } else {
      _previous = s;
    }
    setState(() {
      _smoothed = s;
      _trend = trend;
      _lastSeen = DateTime.now();
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final name = _member?['name'] as String? ?? '';
    final seenRecently = _lastSeen != null && DateTime.now().difference(_lastSeen!) < const Duration(seconds: 8);
    final metres = _smoothed == null ? null : rssiToMetres(_smoothed!.round());
    final (Color color, String label, IconData icon) = switch ((seenRecently, _trend)) {
      (false, _) => (RafeeqColors.ink600, t.finderSearching, Icons.bluetooth_searching_rounded),
      (true, _Trend.warmer) => (RafeeqColors.danger, t.finderWarmer, Icons.local_fire_department_rounded),
      (true, _Trend.colder) => (const Color(0xFF1565C0), t.finderColder, Icons.ac_unit_rounded),
      _ => (RafeeqColors.gold500, t.finderSame, Icons.bluetooth_connected_rounded),
    };

    return Scaffold(
      appBar: AppBar(title: Text(t.findName(name))),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _error != null
              ? Center(
                  child: Text(
                    switch (_error) {
                      'permission' => t.finderPermission,
                      'member' => t.finderNoMember,
                      _ => t.finderBluetoothOff,
                    },
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20),
                  ),
                )
              : Column(children: [
                  Text(t.finderHint, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18)),
                  const Spacer(),
                  Semantics(
                    liveRegion: true,
                    label: label,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 400),
                      width: 240,
                      height: 240,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: color.withValues(alpha: 0.15), border: Border.all(color: color, width: 8)),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(icon, size: 72, color: color),
                        const SizedBox(height: 8),
                        Text(label, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: color)),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (seenRecently && metres != null)
                    Text(t.finderAbout(metres < 1 ? 1 : metres.round()), style: Theme.of(context).textTheme.headlineSmall),
                  const Spacer(),
                  Text(t.finderNote, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
                ]),
        ),
      ),
    );
  }
}
