import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../util/geo.dart';
import '../../widgets/common.dart';

/// OpenStreetMap tiles. Fine for the demo; before launch switch to an offline-capable SDK
/// (MapLibre with downloaded tiles) — see docs/decisions.md. Places and routes already
/// come from the offline map pack, so lists and walking directions work without network.
TileLayer osmTiles() => TileLayer(
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      userAgentPackageName: 'sa.bidec.rafeeq',
    );

IconData placeIcon(String type) => switch (type) {
      'holy_site' => Icons.mosque_rounded,
      'gate' => Icons.door_front_door_rounded,
      'lost_and_found' => Icons.support_agent_rounded,
      'gathering_point' => Icons.groups_rounded,
      'hotel' => Icons.hotel_rounded,
      'toilet' => Icons.wc_rounded,
      'shopping' => Icons.storefront_rounded,
      _ => Icons.place_rounded,
    };

String placeTypeLabel(AppLocalizations t, String type) => switch (type) {
      'holy_site' => t.ptHolySite,
      'gate' => t.ptGate,
      'lost_and_found' => t.ptLostFound,
      'gathering_point' => t.ptGathering,
      'hotel' => t.ptHotel,
      'toilet' => t.ptToilet,
      'shopping' => t.ptShopping,
      _ => type,
    };

/// Map and list of places from the offline map pack, filtered by type.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key, this.filter});
  final String? filter;

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  late String? _type = widget.filter;
  bool _showList = false;

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final lang = session.locale?.languageCode ?? 'en';
    final me = session.me!;
    final city = me.city ?? 'makkah';
    final pack = ref.watch(mapPackProvider(city));
    final hotel = me.hotel;

    return Scaffold(
      appBar: AppBar(title: Text(t.map), actions: [
        IconButton(
          tooltip: _showList ? t.showMap : t.showList,
          icon: Icon(_showList ? Icons.map_rounded : Icons.list_rounded),
          onPressed: () => setState(() => _showList = !_showList),
        ),
      ]),
      body: AsyncView(
        value: pack,
        onRetry: () => ref.invalidate(mapPackProvider(city)),
        builder: (p) {
          final places = asList(p['places']).where((x) => _type == null || x['type'] == _type).toList();
          // Nearest first, measured from the hotel.
          if (hotel != null) {
            final hl = (hotel['lat'] as num).toDouble(), hg = (hotel['lng'] as num).toDouble();
            places.sort((a, b) => distanceM(hl, hg, (a['lat'] as num).toDouble(), (a['lng'] as num).toDouble())
                .compareTo(distanceM(hl, hg, (b['lat'] as num).toDouble(), (b['lng'] as num).toDouble())));
          }
          final types = {for (final x in asList(p['places'])) x['type'] as String}.toList()..sort();
          return Column(children: [
            SizedBox(
              height: 60,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: [
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: ChoiceChip(label: Text(t.all), selected: _type == null, onSelected: (_) => setState(() => _type = null)),
                  ),
                  for (final ty in types)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: ChoiceChip(
                        avatar: Icon(placeIcon(ty), size: 18),
                        label: Text(placeTypeLabel(t, ty)),
                        selected: _type == ty,
                        onSelected: (_) => setState(() => _type = ty),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: _showList
                  ? ListView(children: [for (final pl in places) _PlaceTile(place: pl, pack: p, lang: lang)])
                  : FlutterMap(
                      options: MapOptions(
                        initialCenter: places.isNotEmpty
                            ? LatLng((places.first['lat'] as num).toDouble(), (places.first['lng'] as num).toDouble())
                            : (city == 'madinah' ? const LatLng(24.4672, 39.6111) : const LatLng(21.4225, 39.8262)),
                        initialZoom: 16,
                      ),
                      children: [
                        osmTiles(),
                        MarkerLayer(markers: [
                          if (hotel != null)
                            Marker(
                              point: LatLng((hotel['lat'] as num).toDouble(), (hotel['lng'] as num).toDouble()),
                              width: 44,
                              height: 44,
                              child: const Icon(Icons.hotel_rounded, color: RafeeqColors.gold500, size: 36),
                            ),
                          for (final pl in places)
                            Marker(
                              point: LatLng((pl['lat'] as num).toDouble(), (pl['lng'] as num).toDouble()),
                              width: 48,
                              height: 48,
                              child: Semantics(
                                button: true,
                                label: pick(pl['name'], lang),
                                child: GestureDetector(
                                  onTap: () => showModalBottomSheet<void>(context: context, builder: (_) => _PlaceTile(place: pl, pack: p, lang: lang, expanded: true)),
                                  child: Icon(placeIcon(pl['type'] as String), color: RafeeqColors.brand900, size: 40),
                                ),
                              ),
                            ),
                        ]),
                        const RichAttributionWidget(attributions: [TextSourceAttribution('OpenStreetMap contributors')]),
                      ],
                    ),
            ),
          ]);
        },
      ),
    );
  }
}

/// A place with hours, languages, walking route (if the pack has one) and "Shop online".
class _PlaceTile extends ConsumerWidget {
  const _PlaceTile({required this.place, required this.pack, required this.lang, this.expanded = false});
  final Json place;
  final Json pack;
  final String lang;
  final bool expanded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final hours = place['hours'] is Map ? Map<String, dynamic>.from(place['hours'] as Map) : const <String, dynamic>{};
    final hoursText = hours.isEmpty ? null : (hours['always'] ?? hours.entries.map((e) => '${e.key} ${e.value}').first).toString();
    final langs = (place['languages'] as List? ?? const []).cast<String>();
    final route = asList(pack['routes']).where((r) => r['toPlaceId'] == place['id']).toList();
    final shopId = place['shopProviderId'] as String?;

    final content = Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      ListTile(
        leading: Icon(placeIcon(place['type'] as String), size: 32, color: RafeeqColors.brand700),
        title: Text(pick(place['name'], lang), style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text([
          placeTypeLabel(t, place['type'] as String),
          if (hoursText != null) hoursText,
          if (place['priceRange'] != null) '\$' * (place['priceRange'] as int),
        ].join(' · ')),
      ),
      if (langs.isNotEmpty)
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 72, bottom: 8),
          child: Text(t.languagesSpoken(langs.map((l) => l.toUpperCase()).join(', ')), style: Theme.of(context).textTheme.bodySmall),
        ),
      Padding(
        padding: const EdgeInsetsDirectional.only(start: 72, end: 16, bottom: 12),
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          if (route.isNotEmpty)
            FilledButton.tonalIcon(
              icon: const Icon(Icons.directions_walk_rounded),
              label: Text(t.walkHere),
              onPressed: () {
                if (expanded) Navigator.of(context).pop();
                context.push('/route/${route.first['id']}');
              },
            ),
          if (shopId != null)
            FilledButton.icon(
              icon: const Icon(Icons.shopping_bag_rounded),
              label: Text(t.shopOnline),
              onPressed: () {
                if (expanded) Navigator.of(context).pop();
                context.go('/shop?shop=$shopId');
              },
            ),
        ]),
      ),
    ]);
    return expanded ? SafeArea(child: content) : Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: content);
  }
}
