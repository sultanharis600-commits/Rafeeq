import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../lost/location_service.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import '../profile/profile_screen.dart' show needLabel;

/// One job for a driver, guide, companion or luggage handler: who, where, the pilgrim's
/// needs, start and complete, and (for luggage) the bag scanner. While a transport or
/// assistance job is in progress, the phone shares its location so the pilgrim sees the
/// driver on the map.
class JobScreen extends ConsumerStatefulWidget {
  const JobScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<JobScreen> createState() => _JobScreenState();
}

class _JobScreenState extends ConsumerState<JobScreen> {
  Timer? _share;
  bool _busy = false;

  @override
  void dispose() {
    _share?.cancel();
    super.dispose();
  }

  void _syncSharing(String status, String category) {
    final shouldShare = (status == 'accepted' || status == 'in_progress') && const {'transport', 'accessibility'}.contains(category);
    if (shouldShare && _share == null) {
      _sendLocation();
      _share = Timer.periodic(const Duration(seconds: 30), (_) => _sendLocation());
    } else if (!shouldShare && _share != null) {
      _share!.cancel();
      _share = null;
    }
  }

  Future<void> _sendLocation() async {
    try {
      if (!await LocationService.ensurePermission()) return;
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)));
      await ref.read(apiProvider).post('/staff/bookings/${widget.id}/location', {'lat': p.latitude, 'lng': p.longitude});
    } catch (_) {
      // Weak network: the next tick tries again.
    }
  }

  Future<void> _act(String action) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).post('/staff/bookings/${widget.id}/$action', {});
      ref.invalidate(bookingProvider(widget.id));
      ref.invalidate(staffJobsProvider);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _navigate(Map point) {
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${point['lat']},${point['lng']}&travelmode=driving');
    launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final booking = ref.watch(bookingProvider(widget.id));
    return Scaffold(
      appBar: AppBar(title: Text(t.job)),
      body: AsyncView(
        value: booking,
        onRetry: () => ref.invalidate(bookingProvider(widget.id)),
        builder: (c) {
          final b = c.data;
          final service = asJson(b['service']);
          final category = service['category'] as String;
          final status = b['status'] as String;
          final pilgrim = b['pilgrim'] == null ? null : asJson(b['pilgrim']);
          final needs = ((b['needs'] as List?) ?? const []).cast<String>();
          final bags = asList(b['bags']);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _syncSharing(status, category);
          });

          return ListView(padding: const EdgeInsets.all(16), children: [
            StaleBanner(cached: c),
            Row(children: [
              Icon(categoryIcon(category), size: 40, color: RafeeqColors.brand700),
              const SizedBox(width: 12),
              Expanded(child: Text(service['title'] as String, style: Theme.of(context).textTheme.titleLarge)),
              StatusChip(status),
            ]),
            const SizedBox(height: 12),
            if (b['slot'] != null) InfoRow(t.when, Fmt.dateTime((b['slot'] as Map)['startsAt'] as String?, lang)),
            InfoRow(t.quantity, '${b['quantity']}'),
            if (b['meetingPoint'] != null) InfoRow(t.meetingPoint, b['meetingPoint'] as String),
            if (pilgrim != null)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.person_rounded, size: 32),
                  title: Text(pilgrim['name'] as String),
                  subtitle: Text(t.speaks((pilgrim['language'] as String).toUpperCase())),
                  trailing: pilgrim['phone'] == null
                      ? null
                      : IconButton.filled(tooltip: t.call, icon: const Icon(Icons.call_rounded), onPressed: () => launchUrl(Uri.parse('tel:${pilgrim['phone']}'))),
                ),
              ),
            if (needs.isNotEmpty || b['notes'] != null)
              Card(
                color: const Color(0xFFFFF4E5),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Icon(Icons.accessible_rounded, color: RafeeqColors.danger),
                      const SizedBox(width: 8),
                      Text(t.pilgrimNeeds, style: const TextStyle(fontWeight: FontWeight.w700)),
                    ]),
                    if (needs.isNotEmpty) Text(needs.map((n) => needLabel(t, n)).join(', ')),
                    if (b['notes'] != null) Text(b['notes'] as String),
                  ]),
                ),
              ),
            for (final (label, key) in [(t.pickup, 'pickup'), (t.dropoff, 'dropoff')])
              if (b[key] is Map)
                ListTile(
                  leading: const Icon(Icons.place_rounded),
                  title: Text(label),
                  subtitle: Text(((b[key] as Map)['label'] as String?) ?? ''),
                  trailing: TextButton.icon(icon: const Icon(Icons.navigation_rounded), label: Text(t.navigate), onPressed: () => _navigate(b[key] as Map)),
                ),
            if (_share != null)
              ListTile(leading: const Icon(Icons.share_location_rounded, color: RafeeqColors.brand700), title: Text(t.sharingLocationWithPilgrim)),
            const SizedBox(height: 12),
            if (category == 'luggage') ...[
              SectionTitle(t.yourBags),
              for (final g in bags)
                ListTile(
                  leading: const Icon(Icons.luggage_rounded),
                  title: Text((g['label'] as String?) ?? g['tagCode'] as String),
                  subtitle: Text(g['tagCode'] as String, textDirection: TextDirection.ltr),
                  trailing: StatusChip(g['status'] as String),
                ),
              FilledButton.icon(
                icon: const Icon(Icons.qr_code_scanner_rounded),
                label: Text(t.scanBags),
                onPressed: () => context.push('/staff/scan?booking=${widget.id}'),
              ),
              const SizedBox(height: 8),
            ],
            if (status == 'accepted') FilledButton(onPressed: _busy ? null : () => _act('start'), child: Text(t.startJob)),
            if (status == 'in_progress')
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (d) => AlertDialog(
                            content: Text(t.completeJobConfirm),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(d, false), child: Text(t.cancel)),
                              FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(t.completeJob)),
                            ],
                          ),
                        );
                        if (ok == true) await _act('complete');
                      },
                child: Text(t.completeJob),
              ),
          ]);
        },
      ),
    );
  }
}
