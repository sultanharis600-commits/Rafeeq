import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Bag timeline: Picked up at hotel 09:10 → In van 09:25 → At airport 11:40 → Checked in.
class BagScreen extends ConsumerWidget {
  const BagScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final bag = ref.watch(bagProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(t.bag)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(bagProvider(id)),
        child: AsyncView(
          value: bag,
          onRetry: () => ref.invalidate(bagProvider(id)),
          builder: (c) {
            final b = c.data;
            final scans = asList(b['scans']).where((s) => s['corrected'] != true).toList();
            final cases = asList(b['cases']);
            final openCase = cases.any((x) => x['status'] == 'open');
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                StaleBanner(cached: c),
                Row(children: [
                  const Icon(Icons.luggage_rounded, size: 40, color: RafeeqColors.brand700),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text((b['label'] as String?) ?? t.bag, style: Theme.of(context).textTheme.titleLarge),
                      Text(b['tagCode'] as String, textDirection: TextDirection.ltr),
                    ]),
                  ),
                  StatusChip(b['status'] as String),
                ]),
                if (openCase)
                  Card(
                    color: const Color(0xFFFBE4E2),
                    child: Padding(padding: const EdgeInsets.all(12), child: Text(t.bagCaseOpen)),
                  ),
                const SizedBox(height: 16),
                for (var i = 0; i < scans.length; i++)
                  _Step(
                    title: handoverLabel(t, scans[i]['place'] as String),
                    subtitle: '${Fmt.time(scans[i]['scannedAt'] as String, lang)} · ${t.heldBy(scans[i]['heldBy'] as String)}',
                    last: i == scans.length - 1,
                  ),
                if (b['expectedNextScanBy'] != null)
                  Padding(padding: const EdgeInsets.only(top: 8), child: Text(t.nextHandoverBy(Fmt.time(b['expectedNextScanBy'] as String, lang)))),
                const SizedBox(height: 24),
                if (!openCase && !['delivered', 'found'].contains(b['status']))
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(foregroundColor: RafeeqColors.danger),
                    icon: const Icon(Icons.report_rounded),
                    label: Text(t.reportMissing),
                    onPressed: () async {
                      try {
                        await ref.read(apiProvider).post('/bags/$id/report-missing', {});
                        ref.invalidate(bagProvider(id));
                        if (context.mounted) showDone(context, t.bagReported);
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.title, required this.subtitle, required this.last});
  final String title;
  final String subtitle;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Column(children: [
          Icon(last ? Icons.radio_button_checked_rounded : Icons.check_circle_rounded, color: RafeeqColors.brand700, size: 28),
          if (!last) Expanded(child: Container(width: 3, color: RafeeqColors.brand100)),
        ]),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            ]),
          ),
        ),
      ]),
    );
  }
}
