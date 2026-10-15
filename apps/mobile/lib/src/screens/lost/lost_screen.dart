
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/client.dart';
import '../../api/offline_queue.dart';
import '../../config.dart';
import '../../data.dart';
import '../../lost/location_service.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/geo.dart';
import '../../widgets/common.dart';

/// "I'm lost" (guide: Lost Companion). One press:
/// 1. gets the best location it can (fresh GPS, else the last stored point);
/// 2. with data: raises the alert on the server, which tells the group (push) and the
///    leader and emergency contacts (SMS with a map link);
/// 3. without data: queues the alert and opens a ready-made SMS to the group leader and
///    the Rafeeq number, with GPS coordinates. SMS needs only a phone signal.
/// The screen then shows what to do while waiting, in large text.
class LostScreen extends ConsumerStatefulWidget {
  const LostScreen({super.key});

  @override
  ConsumerState<LostScreen> createState() => _LostScreenState();
}

enum _Stage { locating, sent, queued, failed }

class _LostScreenState extends ConsumerState<LostScreen> {
  _Stage _stage = _Stage.locating;
  LastFix? _fix;
  String? _alertId;
  Json? _group;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _raise());
  }

  List<Json> _leaders() {
    final g = _group;
    if (g == null) return const [];
    final me = ref.read(sessionProvider).me!;
    final members = asList(g['members']).where((m) => m['userId'] != me.id).toList();
    final leaders = members.where((m) => m['role'] == 'leader').toList();
    return leaders.isNotEmpty ? leaders : members.take(1).toList();
  }

  Future<void> _raise() async {
    // Load the group first (from the phone's cache if offline) so SMS has a recipient.
    try {
      final groups = await ref.read(groupsProvider.future);
      _group = groups.data.isEmpty ? null : groups.data.first;
    } catch (_) {}
    final fix = await ref.read(locationServiceProvider).currentOrLast();
    if (!mounted) return;
    setState(() => _fix = fix);

    final body = {
      if (fix != null) 'lat': fix.lat,
      if (fix != null) 'lng': fix.lng,
      if (fix?.accuracyM != null) 'accuracyM': fix!.accuracyM,
    };
    try {
      final res = asJson(await ref.read(apiProvider).post('/lost-alerts', body));
      if (!mounted) return;
      setState(() {
        _alertId = res['id'] as String?;
        _stage = _Stage.sent;
      });
    } on ApiException catch (e) {
      if (!e.offline) {
        if (mounted) setState(() => _stage = _Stage.failed);
        return;
      }
      final now = DateTime.now();
      await ref.read(offlineQueueProvider.notifier).add(QueuedAction(id: 'lost-${now.microsecondsSinceEpoch}', kind: 'lost_alert', at: now, body: body));
      if (!mounted) return;
      setState(() => _stage = _Stage.queued);
      await _sendSms();
    }
  }

  /// Opens the SMS app with the message ready; the pilgrim only presses send.
  Future<void> _sendSms() async {
    final t = l10n(context);
    final me = ref.read(sessionProvider).me!;
    final recipients = [..._leaders().map((m) => m['phone'] as String), Config.lostSmsNumber];
    final text = lostSms(name: me.name, lat: _fix?.lat, lng: _fix?.lng, accuracyM: _fix?.accuracyM, template: t.lostSmsTemplate);
    // Android accepts several numbers separated by commas; iOS uses the first.
    final uri = Uri(scheme: 'sms', path: recipients.join(','), queryParameters: {'body': text});
    await launchUrl(uri);
  }

  Future<void> _found() async {
    final id = _alertId;
    if (id != null) {
      try {
        await ref.read(apiProvider).patch('/lost-alerts/$id', {'status': 'resolved'});
      } catch (e) {
        if (mounted) showError(context, e);
        return;
      }
    } else {
      // Alert still waiting offline: drop it so the group isn't told later.
      await ref.read(offlineQueueProvider.notifier).removeKind('lost_alert');
    }
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final big = Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700);
    final leaders = _leaders();

    return Scaffold(
      backgroundColor: _stage == _Stage.failed ? Colors.white : const Color(0xFFFFF4F2),
      appBar: AppBar(title: Text(t.imLost), backgroundColor: RafeeqColors.danger, foregroundColor: Colors.white),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Semantics(
              liveRegion: true,
              child: Text(
                switch (_stage) {
                  _Stage.locating => t.lostLocating,
                  _Stage.sent => t.lostSent,
                  _Stage.queued => t.lostQueued,
                  _Stage.failed => t.lostFailed,
                },
                style: big,
              ),
            ),
            if (_stage == _Stage.locating) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            const SizedBox(height: 16),
            if (_stage != _Stage.locating) ...[
              _Advice(icon: Icons.accessibility_new, text: t.lostStay),
              _Advice(icon: Icons.volume_up, text: t.lostShowStaff),
              const SizedBox(height: 12),
              if (_fix != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.my_location, size: 32, color: RafeeqColors.brand700),
                    title: Text(t.yourLocation),
                    subtitle: Text(
                      '${_fix!.lat.toStringAsFixed(5)}, ${_fix!.lng.toStringAsFixed(5)}'
                      '${_fix!.accuracyM != null ? ' (±${_fix!.accuracyM!.round()} m)' : ''}',
                      textDirection: TextDirection.ltr,
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: RafeeqColors.danger, minimumSize: const Size.fromHeight(64)),
                icon: const Icon(Icons.sms, size: 28),
                label: Text(t.lostSendSms, style: const TextStyle(fontSize: 20)),
                onPressed: _sendSms,
              ),
              const SizedBox(height: 8),
              for (final l in leaders)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.call),
                    label: Text(t.callName(l['name'] as String)),
                    onPressed: () => launchUrl(Uri.parse('tel:${l['phone']}')),
                  ),
                ),
              if (_group == null) Text(t.lostNoGroup, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.support_agent),
                label: Text(t.nearestLostAndFound),
                onPressed: () => context.push('/map?type=lost_and_found'),
              ),
              const SizedBox(height: 24),
              FilledButton(onPressed: _found, child: Text(t.imFound)),
            ],
          ],
        ),
      ),
    );
  }
}

class _Advice extends StatelessWidget {
  const _Advice({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 32, color: RafeeqColors.brand700),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 20))),
        ]),
      );
}
