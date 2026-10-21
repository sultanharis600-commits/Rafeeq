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
      appBar: heroAppBar(title: t.tabGuide),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(mapPackProvider(city)),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            // Prayer times run edge to edge under the header, as one band (no box).
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.zero,
                child: DecoratedBox(
                  decoration: const BoxDecoration(gradient: RafeeqColors.heroGradient),
                  child: Stack(
                    children: [
                      const Positioned.fill(
                        child: ExcludeSemantics(child: CustomPaint(painter: KhatimPattern(cell: 38))),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const IconBadge(Icons.mosque_rounded, background: Color(0x33E9CD85), color: RafeeqColors.gold300, size: 40),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    t.prayerTimes,
                                    style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
                                  child: Text(
                                    city == 'madinah' ? t.madinah : t.makkah,
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                            if (next != null) ...[
                              const SizedBox(height: 14),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(gradient: RafeeqColors.goldGradient, borderRadius: BorderRadius.circular(16)),
                                child: Row(
                                  children: [
                                    const Icon(Icons.schedule_rounded, color: RafeeqColors.brand950),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        t.nextPrayer(prayerName(t, next.$1), Fmt.hm(next.$2, lang), next.$2.difference(nowLocal).inMinutes),
                                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: RafeeqColors.brand950),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 10),
                            for (final p in times.all)
                              Container(
                                margin: const EdgeInsets.only(top: 4),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: next?.$1 == p.$1 ? Colors.white.withValues(alpha: 0.16) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        prayerName(t, p.$1),
                                        style: TextStyle(color: Colors.white, fontWeight: next?.$1 == p.$1 ? FontWeight.w800 : FontWeight.w500),
                                      ),
                                    ),
                                    Text(
                                      Fmt.hm(p.$2, lang),
                                      style: TextStyle(
                                        color: next?.$1 == p.$1 ? RafeeqColors.gold300 : Colors.white,
                                        fontWeight: next?.$1 == p.$1 ? FontWeight.w800 : FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            const SizedBox(height: 8),
                            Text(t.prayerMethod, style: const TextStyle(color: Colors.white70, fontSize: 14)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            GridView.count(
              crossAxisCount: a11y ? 2 : 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              childAspectRatio: a11y ? 1.1 : 0.95,
              children: [
                BigTile(icon: Icons.explore_rounded, label: t.qibla, color: RafeeqColors.brand700, tint: RafeeqColors.brand100, onTap: () => context.push('/qibla')),
                BigTile(icon: Icons.mosque_rounded, label: t.holySitesMap, color: RafeeqColors.gold700, tint: const Color(0xFFFCF3BD), onTap: () => context.push('/map')),
                BigTile(icon: Icons.door_front_door_rounded, label: t.ptGate, color: const Color(0xFF0F6E66), tint: const Color(0xFFDDF3F0), onTap: () => context.push('/map?type=gate')),
                BigTile(
                  icon: Icons.storefront_rounded,
                  label: t.shoppingPlaces,
                  color: RafeeqColors.clay700, tint: RafeeqColors.clay100,
                  onTap: () => context.push('/map?type=shopping'),
                ),
                BigTile(
                  icon: Icons.support_agent_rounded,
                  label: t.ptLostFound,
                  color: const Color(0xFF1F5F8B), tint: const Color(0xFFE0ECF7),
                  onTap: () => context.push('/map?type=lost_and_found'),
                ),
                BigTile(icon: Icons.wc_rounded, label: t.ptToilet, color: RafeeqColors.lavender500, tint: const Color(0xFFEFE6F5), onTap: () => context.push('/map?type=toilet')),
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
                return Column(
                  children: [
                    for (final r in routes)
                      ListTile(
                        leading: Icon(
                          r['accessible'] == true ? Icons.accessible_rounded : Icons.directions_walk_rounded,
                          size: 30,
                          color: RafeeqColors.brand700,
                        ),
                        title: Text('${pick(places[r['fromPlaceId']]?['name'], lang)} → ${pick(places[r['toPlaceId']]?['name'], lang)}'),
                        subtitle: Text(t.metresMinutes(r['distanceM'] as int, r['minutes'] as int)),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push('/route/${r['id']}'),
                      ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(t.mapPackSaved, style: Theme.of(context).textTheme.bodySmall),
                    ),
                  ],
                );
              },
            ),
            SectionTitle(t.shoppingPlaces),
            pack.maybeWhen(
              data: (p) => Column(
                children: [
                  for (final s in asList(p['places']).where((x) => x['type'] == 'shopping'))
                    ListTile(
                      leading: IconBadge(placeIcon('shopping'), background: RafeeqColors.clay100, color: RafeeqColors.clay700),
                      title: Text(pick(s['name'], lang)),
                      subtitle: Text(((s['sells'] as List?) ?? const []).map((x) => sectionLabel(t, x as String)).join(', ')),
                      trailing: s['shopProviderId'] != null
                          ? TextButton(onPressed: () => context.go('/shop?shop=${s['shopProviderId']}'), child: Text(t.shopOnline))
                          : null,
                      onTap: () => context.push('/map?type=shopping'),
                    ),
                ],
              ),
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
