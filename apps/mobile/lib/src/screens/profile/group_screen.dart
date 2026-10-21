import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../guide/map_screen.dart' show osmTiles;

/// Travel group (guide: Lost Companion): create or join with a QR code, see members'
/// last known location, answer "I'm lost" alerts, and open the Bluetooth finder.
/// Refreshes every 30 seconds while open; works read-only from the phone's cache offline.
class GroupScreen extends ConsumerStatefulWidget {
  const GroupScreen({super.key});

  @override
  ConsumerState<GroupScreen> createState() => _GroupScreenState();
}

class _GroupScreenState extends ConsumerState<GroupScreen> {
  Timer? _refresh;

  @override
  void initState() {
    super.initState();
    _refresh = Timer.periodic(const Duration(seconds: 30), (_) => ref.invalidate(groupsProvider));
  }

  @override
  void dispose() {
    _refresh?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final groups = ref.watch(groupsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t.travelGroup)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(groupsProvider),
        child: AsyncView(
          value: groups,
          onRetry: () => ref.invalidate(groupsProvider),
          builder: (c) => ListView(padding: const EdgeInsets.only(bottom: 24), children: [
            StaleBanner(cached: c),
            if (c.data.isEmpty) const _NoGroup(),
            for (final g in c.data) _Group(group: g),
            if (c.data.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton.icon(icon: const Icon(Icons.group_add_rounded), label: Text(t.joinAnotherGroup), onPressed: () => _join(context, ref)),
              ),
          ]),
        ),
      ),
    );
  }
}

Future<void> _join(BuildContext context, WidgetRef ref, {String? code}) async {
  final t = l10n(context);
  final controller = TextEditingController(text: code ?? '');
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(t.joinGroup),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(
          controller: controller,
          textCapitalization: TextCapitalization.characters,
          textDirection: TextDirection.ltr,
          decoration: InputDecoration(labelText: t.joinCode, hintText: 'ABC-1234'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          icon: const Icon(Icons.qr_code_scanner_rounded),
          label: Text(t.scanQr),
          onPressed: () async {
            final scanned = await Navigator.of(c).push<String>(MaterialPageRoute(builder: (_) => const _QrScan()));
            if (scanned != null) controller.text = scanned;
          },
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(t.cancel)),
        FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(t.join)),
      ],
    ),
  );
  if (ok != true) return;
  try {
    await ref.read(apiProvider).post('/groups/join', {'joinCode': controller.text.trim().toUpperCase()});
    ref.invalidate(groupsProvider);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class _NoGroup extends ConsumerWidget {
  const _NoGroup();

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final t = l10n(context);
    final name = TextEditingController(text: t.myFamily);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(t.createGroup),
        content: TextField(controller: name, decoration: InputDecoration(labelText: t.groupName)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(t.cancel)),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(t.create)),
        ],
      ),
    );
    if (ok != true || name.text.trim().isEmpty) return;
    try {
      await ref.read(apiProvider).post('/groups', {'name': name.text.trim()});
      ref.invalidate(groupsProvider);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Icon(Icons.groups_rounded, size: 72, color: RafeeqColors.brand700),
        const SizedBox(height: 12),
        Text(t.groupIntro, style: const TextStyle(fontSize: 18)),
        const SizedBox(height: 20),
        FilledButton.icon(icon: const Icon(Icons.qr_code_scanner_rounded), label: Text(t.joinGroup), onPressed: () => _join(context, ref)),
        const SizedBox(height: 12),
        OutlinedButton.icon(icon: const Icon(Icons.add_rounded), label: Text(t.createGroup), onPressed: () => _create(context, ref)),
      ]),
    );
  }
}

class _Group extends ConsumerWidget {
  const _Group({required this.group});
  final Json group;

  String _age(BuildContext context, String iso) {
    final t = l10n(context);
    final m = DateTime.now().toUtc().difference(DateTime.parse(iso)).inMinutes;
    return m < 1 ? t.justNow : t.minutesAgo(m);
  }

  Future<void> _setAlert(BuildContext context, WidgetRef ref, String id, String status) async {
    try {
      await ref.read(apiProvider).patch('/lost-alerts/$id', {'status': status});
      ref.invalidate(groupsProvider);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final me = ref.watch(sessionProvider).me!;
    final members = asList(group['members']);
    final alerts = asList(group['alerts']);
    final located = members.where((m) => m['lastLocation'] != null).toList();
    Json? member(String id) => members.where((m) => m['userId'] == id).firstOrNull;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final a in alerts)
        Card(
          color: const Color(0xFFFBE4E2),
          margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                const Icon(Icons.sos_rounded, color: RafeeqColors.danger, size: 36),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    t.alertFrom(member(a['userId'] as String)?['name'] as String? ?? '—', _age(context, a['createdAt'] as String)),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ),
                StatusChip(a['status'] as String),
              ]),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                if (a['userId'] != me.id)
                  FilledButton.icon(
                    icon: const Icon(Icons.bluetooth_searching_rounded),
                    label: Text(t.findNearby),
                    onPressed: () => context.push('/finder/${a['userId']}'),
                  ),
                if (member(a['userId'] as String)?['phone'] != null)
                  OutlinedButton.icon(
                    icon: const Icon(Icons.call_rounded),
                    label: Text(t.call),
                    onPressed: () => launchUrl(Uri.parse('tel:${member(a['userId'] as String)!['phone']}')),
                  ),
                if (a['status'] == 'open' && a['userId'] != me.id)
                  OutlinedButton(onPressed: () => _setAlert(context, ref, a['id'] as String, 'acknowledged'), child: Text(t.imComing)),
                OutlinedButton(onPressed: () => _setAlert(context, ref, a['id'] as String, 'resolved'), child: Text(t.markFound)),
              ]),
            ]),
          ),
        ),
      SectionTitle(
        group['name'] as String,
        trailing: TextButton.icon(
          icon: const Icon(Icons.qr_code_rounded),
          label: Text(group['joinCode'] as String, textDirection: TextDirection.ltr),
          onPressed: () => showDialog<void>(
            context: context,
            builder: (c) => AlertDialog(
              title: Text(t.inviteToGroup),
              content: SizedBox(
                width: 260,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  QrImageView(data: group['joinCode'] as String, size: 220),
                  const SizedBox(height: 8),
                  SelectableText(group['joinCode'] as String, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 2)),
                  const SizedBox(height: 8),
                  Text(t.inviteHint, textAlign: TextAlign.center),
                ]),
              ),
              actions: [TextButton(onPressed: () => Navigator.pop(c), child: Text(t.close))],
            ),
          ),
        ),
      ),
      if (located.isNotEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              height: 220,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: LatLng((located.first['lastLocation']['lat'] as num).toDouble(), (located.first['lastLocation']['lng'] as num).toDouble()),
                  initialZoom: 15,
                ),
                children: [
                  osmTiles(),
                  MarkerLayer(markers: [
                    for (final m in located)
                      Marker(
                        point: LatLng((m['lastLocation']['lat'] as num).toDouble(), (m['lastLocation']['lng'] as num).toDouble()),
                        width: 120,
                        height: 56,
                        child: Column(children: [
                          Icon(Icons.person_pin_circle_rounded, size: 36, color: alerts.any((a) => a['userId'] == m['userId']) ? RafeeqColors.danger : RafeeqColors.brand900),
                          Text((m['name'] as String).split(' ').first, style: const TextStyle(fontWeight: FontWeight.w700, backgroundColor: Colors.white)),
                        ]),
                      ),
                  ]),
                ],
              ),
            ),
          ),
        ),
      for (final m in members)
        ListTile(
          leading: Icon(
            m['accessibilityMode'] == true ? Icons.accessible_rounded : Icons.person_rounded,
            size: 32,
            color: alerts.any((a) => a['userId'] == m['userId']) ? RafeeqColors.danger : RafeeqColors.brand700,
          ),
          title: Text([m['name'] as String, if (m['userId'] == me.id) t.you].join(' ')),
          subtitle: Text([
            if (m['role'] == 'leader') t.leader,
            if (m['relation'] != null) m['relation'] as String,
            if (m['trackerTag'] != null) m['trackerTag'] as String,
            if (m['lastLocation'] != null) t.lastSeen(_age(context, m['lastLocation']['recordedAt'] as String)) else if (m['sharesLocation'] != true) t.notSharing,
          ].join(' · ')),
          trailing: m['userId'] == me.id
              ? null
              : Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(tooltip: t.findNearby, icon: const Icon(Icons.bluetooth_searching_rounded), onPressed: () => context.push('/finder/${m['userId']}')),
                  IconButton(tooltip: t.call, icon: const Icon(Icons.call_rounded), onPressed: () => launchUrl(Uri.parse('tel:${m['phone']}'))),
                ]),
        ),
    ]);
  }
}

class _QrScan extends StatefulWidget {
  const _QrScan();

  @override
  State<_QrScan> createState() => _QrScanState();
}

class _QrScanState extends State<_QrScan> {
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(l10n(context).scanQr)),
      body: MobileScanner(
        onDetect: (capture) {
          final v = capture.barcodes.firstOrNull?.rawValue;
          if (_done || v == null || !RegExp(r'^[A-Za-z]{3}-\d{4}$').hasMatch(v.trim())) return;
          _done = true;
          Navigator.of(context).pop(v.trim().toUpperCase());
        },
      ),
    );
  }
}
