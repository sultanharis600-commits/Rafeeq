import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../util/prayer_times.dart';
import '../../widgets/common.dart';
import 'map_screen.dart';

/// Guide tab: prayer times (computed on the phone), Qibla, holy sites map, walking
/// directions and the shopping places guide. Everything here works offline once the
/// city's map pack is on the phone.
class GuideScreen extends ConsumerStatefulWidget {
  const GuideScreen({super.key});

  @override
  ConsumerState<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends ConsumerState<GuideScreen> {
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final lang = session.locale?.languageCode ?? 'en';
    final me = session.me!;
    final city = me.city ?? 'makkah';
    final a11y = session.accessibilityMode;
    final pack = ref.watch(mapPackProvider(city));

    // Prayer times for the hotel (or the mosque of the city) in Saudi time.
    final lat = (me.hotel?['lat'] as num?)?.toDouble() ?? (city == 'madinah' ? 24.4672 : 21.4225);
    final lng = (me.hotel?['lng'] as num?)?.toDouble() ?? (city == 'madinah' ? 39.6111 : 39.8262);
    final saudiNow = Fmt.saudi(DateTime.now().toUtc());
    final today = DateTime(saudiNow.year, saudiNow.month, saudiNow.day);
    final times = PrayerTimes.compute(date: today, lat: lat, lng: lng);
    final nowLocal = DateTime(saudiNow.year, saudiNow.month, saudiNow.day, saudiNow.hour, saudiNow.minute);
    final next = times.next(nowLocal);

    return Scaffold(
      appBar: AppBar(title: Text(t.tabGuide)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(mapPackProvider(city)),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Card(
              margin: const EdgeInsets.all(16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.access_time, color: RafeeqColors.brand700),
                    const SizedBox(width: 8),
                    Expanded(child: Text(t.prayerTimes, style: Theme.of(context).textTheme.titleLarge)),
                    Text(city == 'madinah' ? t.madinah : t.makkah),
                  ]),
                  if (next != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      t.nextPrayer(prayerName(t, next.$1), Fmt.hm(next.$2, lang), next.$2.difference(nowLocal).inMinutes),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: RafeeqColors.brand900),
                    ),
                  ],
                  const Divider(height: 24),
                  for (final p in times.all)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(children: [
                        Expanded(
                          child: Text(prayerName(t, p.$1), style: TextStyle(fontWeight: next?.$1 == p.$1 ? FontWeight.w800 : FontWeight.w400)),
                        ),
                        Text(Fmt.hm(p.$2, lang), style: TextStyle(fontWeight: next?.$1 == p.$1 ? FontWeight.w800 : FontWeight.w400)),
                      ]),
                    ),
                  const SizedBox(height: 4),
                  Text(t.prayerMethod, style: Theme.of(context).textTheme.bodySmall),
                ]),
              ),
            ),
            GridView.count(
              crossAxisCount: a11y ? 2 : 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: [
                BigTile(icon: Icons.explore, label: t.qibla, onTap: () => context.push('/qibla')),
                BigTile(icon: Icons.mosque, label: t.holySitesMap, onTap: () => context.push('/map')),
                BigTile(icon: Icons.door_front_door, label: t.ptGate, onTap: () => context.push('/map?type=gate')),
                BigTile(icon: Icons.storefront, label: t.shoppingPlaces, onTap: () => context.push('/map?type=shopping')),
                BigTile(icon: Icons.support_agent, label: t.ptLostFound, onTap: () => context.push('/map?type=lost_and_found')),
                BigTile(icon: Icons.wc, label: t.ptToilet, onTap: () => context.push('/map?type=toilet')),
              ],
            ),
            SectionTitle(t.walkingDirections),
            AsyncView(
              value: pack,
              onRetry: () => ref.invalidate(mapPackProvider(city)),
              builder: (p) {
                final places = {for (final x in asList(p['places'])) x['id'] as String: x};
                final routes = asList(p['routes']);
                // Routes starting at the pilgrim's hotel first; step-free first in accessibility mode.
                final hotelId = me.hotel?['id'];
                routes.sort((a, b) {
                  int score(Json r) => (r['fromPlaceId'] == hotelId ? 0 : 2) + (a11y && r['accessible'] != true ? 1 : 0);
                  return score(a).compareTo(score(b));
                });
                if (routes.isEmpty) return Padding(padding: const EdgeInsets.all(16), child: Text(t.noRoutes));
                return Column(children: [
                  for (final r in routes)
                    ListTile(
                      leading: Icon(r['accessible'] == true ? Icons.accessible : Icons.directions_walk, size: 30, color: RafeeqColors.brand700),
                      title: Text('${pick(places[r['fromPlaceId']]?['name'], lang)} → ${pick(places[r['toPlaceId']]?['name'], lang)}'),
                      subtitle: Text(t.metresMinutes(r['distanceM'] as int, r['minutes'] as int)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/route/${r['id']}'),
                    ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(t.mapPackSaved, style: Theme.of(context).textTheme.bodySmall),
                  ),
                ]);
              },
            ),
            SectionTitle(t.shoppingPlaces),
            pack.maybeWhen(
              data: (p) => Column(children: [
                for (final s in asList(p['places']).where((x) => x['type'] == 'shopping'))
                  ListTile(
                    leading: Icon(placeIcon('shopping'), size: 30, color: RafeeqColors.gold500),
                    title: Text(pick(s['name'], lang)),
                    subtitle: Text(((s['sells'] as List?) ?? const []).map((x) => sectionLabel(t, x as String)).join(', ')),
                    trailing: s['shopProviderId'] != null
                        ? TextButton(onPressed: () => context.go('/shop?shop=${s['shopProviderId']}'), child: Text(t.shopOnline))
                        : null,
                    onTap: () => context.push('/map?type=shopping'),
                  ),
              ]),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

String prayerName(AppLocalizations t, String key) => switch (key) {
      'fajr' => t.fajr,
      'sunrise' => t.sunrise,
      'dhuhr' => t.dhuhr,
      'asr' => t.asr,
      'maghrib' => t.maghrib,
      'isha' => t.isha,
      _ => key,
    };
