import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../api/offline_queue.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import '../../session.dart';

/// Handover points, in the order staff usually meet them.
const handoverPoints = ['hotel_lobby', 'van', 'storage_room', 'airport_counter', 'checked_in', 'shipping_depot', 'madinah_hotel_lobby', 'handed_to_pilgrim'];

final _tagCode = RegExp(r'^RFQ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$');

/// Bag scanner (guide: Baggage tracking). Scan the QR tag, pick where the handover is,
/// confirm. Scans are stored on the phone first and sent when there is network; each
/// keeps the time it happened. Opened from a luggage job, the first scan of a new tag
/// links it to that booking.
class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key, this.bookingId});
  final String? bookingId;

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  String _place = 'hotel_lobby';
  String? _pending; // tag waiting for confirmation
  final List<(String, String, DateTime)> _done = [];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onCode(String raw) {
    final code = raw.trim().toUpperCase();
    if (!_tagCode.hasMatch(code) || _pending != null) return;
    HapticFeedback.mediumImpact();
    setState(() => _pending = code);
  }

  Future<void> _confirm({String? label}) async {
    final code = _pending;
    if (code == null) return;
    final now = DateTime.now();
    final clientId = 'scan-${now.microsecondsSinceEpoch}-${Random().nextInt(1 << 30)}';
    await ref.read(offlineQueueProvider.notifier).add(QueuedAction(
          id: clientId,
          kind: 'bag_scan',
          at: now,
          body: {
            'tagCode': code,
            'placeLabel': _place,
            'scannedAt': now.toUtc().toIso8601String(),
            'clientId': clientId,
            if (widget.bookingId != null) 'bookingId': widget.bookingId,
            if (label != null && label.trim().isNotEmpty) 'label': label.trim(),
          },
        ));
    setState(() {
      _done.insert(0, (code, _place, now));
      _pending = null;
    });
  }

  Future<void> _manual() async {
    final t = l10n(context);
    final c = TextEditingController(text: 'RFQ-');
    final code = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(t.typeTagCode),
        content: TextField(controller: c, textCapitalization: TextCapitalization.characters, textDirection: TextDirection.ltr, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d), child: Text(t.cancel)),
          FilledButton(onPressed: () => Navigator.pop(d, c.text), child: Text(t.ok)),
        ],
      ),
    );
    if (code == null) return;
    if (!_tagCode.hasMatch(code.trim().toUpperCase())) {
      if (mounted) showDone(context, t.invalidTag);
      return;
    }
    _onCode(code);
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final queue = ref.watch(offlineQueueProvider);
    final waitingIds = queue.where((a) => a.kind == 'bag_scan').map((a) => a.body['tagCode']).toSet();

    return Scaffold(
      appBar: AppBar(title: Text(t.scanBags), actions: [
        IconButton(tooltip: t.typeTagCode, icon: const Icon(Icons.keyboard), onPressed: _manual),
        IconButton(tooltip: t.torch, icon: const Icon(Icons.flashlight_on), onPressed: () => _controller.toggleTorch()),
      ]),
      body: Column(children: [
        SizedBox(
          height: 260,
          child: Stack(fit: StackFit.expand, children: [
            MobileScanner(
              controller: _controller,
              onDetect: (capture) {
                for (final b in capture.barcodes) {
                  final v = b.rawValue;
                  if (v != null) _onCode(v);
                }
              },
            ),
            Center(
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Text(t.handoverPoint, style: Theme.of(context).textTheme.titleMedium),
        ),
        SizedBox(
          height: 64,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(8), children: [
            for (final p in handoverPoints)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 8),
                child: ChoiceChip(label: Text(handoverLabel(t, p), style: const TextStyle(fontSize: 16)), selected: _place == p, onSelected: (_) => setState(() => _place = p)),
              ),
          ]),
        ),
        if (_pending != null) _ConfirmCard(code: _pending!, place: handoverLabel(t, _place), firstScan: widget.bookingId != null, onConfirm: _confirm, onCancel: () => setState(() => _pending = null), t: t),
        Expanded(
          child: ListView(children: [
            for (final (code, place, at) in _done)
              ListTile(
                leading: Icon(waitingIds.contains(code) ? Icons.cloud_upload_outlined : Icons.cloud_done, color: waitingIds.contains(code) ? RafeeqColors.gold500 : RafeeqColors.brand700),
                title: Text(code, textDirection: TextDirection.ltr),
                subtitle: Text('${handoverLabel(t, place)} · ${Fmt.hm(at, lang)}'),
                trailing: Text(waitingIds.contains(code) ? t.waiting : t.sent),
              ),
            for (final r in ref.read(offlineQueueProvider.notifier).rejected)
              ListTile(leading: const Icon(Icons.error, color: RafeeqColors.danger), title: Text(r)),
          ]),
        ),
      ]),
    );
  }
}

class _ConfirmCard extends StatefulWidget {
  const _ConfirmCard({required this.code, required this.place, required this.firstScan, required this.onConfirm, required this.onCancel, required this.t});
  final String code;
  final String place;
  final bool firstScan;
  final Future<void> Function({String? label}) onConfirm;
  final VoidCallback onCancel;
  final AppLocalizations t;

  @override
  State<_ConfirmCard> createState() => _ConfirmCardState();
}

class _ConfirmCardState extends State<_ConfirmCard> {
  final _label = TextEditingController();

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    return Card(
      margin: const EdgeInsets.all(12),
      color: RafeeqColors.brand100,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(widget.code, textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          Text(t.scanAt(widget.place), style: const TextStyle(fontSize: 18)),
          if (widget.firstScan) ...[
            const SizedBox(height: 8),
            TextField(controller: _label, decoration: InputDecoration(labelText: t.bagLabelOptional, hintText: t.bagLabelHint)),
          ],
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: widget.onCancel, child: Text(t.cancel))),
            const SizedBox(width: 8),
            Expanded(child: FilledButton(onPressed: () => widget.onConfirm(label: _label.text), child: Text(t.confirm))),
          ]),
        ]),
      ),
    );
  }
}
