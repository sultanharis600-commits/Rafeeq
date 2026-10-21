import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Turn-by-turn walking directions from the offline map pack: large arrows, one step at a
/// time, read aloud in the pilgrim's language. The route is drawn as a simple line that
/// needs no map tiles, so it works with no network.
class RouteScreen extends ConsumerStatefulWidget {
  const RouteScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends ConsumerState<RouteScreen> {
  final _tts = FlutterTts();
  int _step = 0;
  bool _voice = true;

  static const _ttsLocale = {'ar': 'ar-SA', 'en': 'en-US', 'ur': 'ur-PK', 'id': 'id-ID', 'ms': 'ms-MY', 'tr': 'tr-TR'};

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  Future<void> _speak(String text, String lang) async {
    if (!_voice) return;
    try {
      await _tts.setLanguage(_ttsLocale[lang] ?? 'en-US');
      await _tts.setSpeechRate(0.45);
      await _tts.stop();
      await _tts.speak(text);
    } catch (_) {
      // No voice installed for this language: the text is still on screen.
    }
  }

  void _go(int to, List<Json> steps, String lang) {
    setState(() => _step = to.clamp(0, steps.length - 1));
    _speak(pick(steps[_step]['instruction'], lang), lang);
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final lang = session.locale?.languageCode ?? 'en';
    final city = session.me?.city ?? 'makkah';
    final pack = ref.watch(mapPackProvider(city));

    return Scaffold(
      appBar: AppBar(title: Text(t.walkingDirections), actions: [
        IconButton(
          tooltip: _voice ? t.voiceOff : t.voiceOn,
          icon: Icon(_voice ? Icons.volume_up_rounded : Icons.volume_off_rounded),
          onPressed: () {
            setState(() => _voice = !_voice);
            if (!_voice) _tts.stop();
          },
        ),
      ]),
      body: AsyncView(
        value: pack,
        onRetry: () => ref.invalidate(mapPackProvider(city)),
        builder: (p) {
          final route = asList(p['routes']).where((r) => r['id'] == widget.id).firstOrNull;
          if (route == null) return Center(child: Text(t.notFound));
          final places = {for (final x in asList(p['places'])) x['id'] as String: x};
          final from = places[route['fromPlaceId']];
          final to = places[route['toPlaceId']];
          final steps = asList(route['steps']);
          final step = steps[_step];
          final path = (route['path'] as List).map((pt) => ((pt as List)[0] as num).toDouble()).toList();
          final lngs = (route['path'] as List).map((pt) => ((pt as List)[1] as num).toDouble()).toList();
          final dir = step['direction'] as String;
          final rtl = Directionality.of(context) == TextDirection.rtl;

          return SafeArea(
            child: Column(children: [
              ListTile(
                title: Text('${pick(from?['name'], lang)} → ${pick(to?['name'], lang)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text([
                  t.metresMinutes(route['distanceM'] as int, route['minutes'] as int),
                  if (route['accessible'] == true) t.stepFree else t.hasSteps,
                ].join(' · ')),
                leading: Icon(route['accessible'] == true ? Icons.accessible_rounded : Icons.stairs_rounded, size: 32, color: RafeeqColors.brand700),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: CustomPaint(
                    painter: _RoutePainter(lats: path, lngs: lngs, highlight: _step),
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
              Card(
                margin: const EdgeInsets.all(16),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(children: [
                    Icon(
                      switch (dir) {
                        // Left and right are about the walker, not the screen, so they don't flip in RTL.
                        'left' => Icons.turn_left_rounded,
                        'right' => Icons.turn_right_rounded,
                        'arrive' => Icons.flag_rounded,
                        _ => Icons.straight_rounded,
                      },
                      textDirection: rtl ? TextDirection.ltr : null,
                      size: 72,
                      color: RafeeqColors.brand900,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Semantics(
                        liveRegion: true,
                        child: Text(pick(step['instruction'], lang), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Row(children: [
                  Expanded(child: OutlinedButton(onPressed: _step == 0 ? null : () => _go(_step - 1, steps, lang), child: Text(t.previous))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _step == steps.length - 1 ? null : () => _go(_step + 1, steps, lang),
                      child: Text(_step == 0 && steps.length > 1 ? t.start : t.next),
                    ),
                  ),
                ]),
              ),
              TextButton.icon(icon: const Icon(Icons.replay_rounded), label: Text(t.repeat), onPressed: () => _speak(pick(step['instruction'], lang), lang)),
            ]),
          );
        },
      ),
    );
  }
}

/// Draws the route scaled to fit, north up. Leg [highlight] is drawn thicker.
class _RoutePainter extends CustomPainter {
  _RoutePainter({required this.lats, required this.lngs, required this.highlight});
  final List<double> lats;
  final List<double> lngs;
  final int highlight;

  @override
  void paint(Canvas canvas, Size size) {
    if (lats.length < 2) return;
    final minLat = lats.reduce(math.min), maxLat = lats.reduce(math.max);
    final minLng = lngs.reduce(math.min), maxLng = lngs.reduce(math.max);
    final latSpan = math.max(maxLat - minLat, 1e-5), lngSpan = math.max(maxLng - minLng, 1e-5);
    final scale = math.min((size.width - 40) / lngSpan, (size.height - 40) / latSpan);
    Offset at(int i) => Offset(
          20 + (lngs[i] - minLng) * scale + (size.width - 40 - lngSpan * scale) / 2,
          20 + (maxLat - lats[i]) * scale + (size.height - 40 - latSpan * scale) / 2,
        );
    final base = Paint()
      ..color = RafeeqColors.brand100
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;
    final hi = Paint()
      ..color = RafeeqColors.brand700
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < lats.length - 1; i++) {
      canvas.drawLine(at(i), at(i + 1), i == highlight ? hi : base);
    }
    canvas.drawCircle(at(0), 12, Paint()..color = RafeeqColors.gold500);
    canvas.drawCircle(at(lats.length - 1), 14, Paint()..color = RafeeqColors.brand900);
  }

  @override
  bool shouldRepaint(_RoutePainter old) => old.highlight != highlight || old.lats != lats;
}
