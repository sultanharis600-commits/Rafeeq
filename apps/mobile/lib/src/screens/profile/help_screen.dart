import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Help: emergency numbers, lost-and-found, and help articles (from the admin panel).
class HelpScreen extends ConsumerWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final help = ref.watch(helpProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t.help)),
      body: ListView(children: [
        Card(
          margin: const EdgeInsets.all(16),
          color: const Color(0xFFFBE4E2),
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.local_hospital_rounded, color: RafeeqColors.danger, size: 32),
              title: Text(t.emergency911),
              trailing: IconButton.filled(tooltip: t.call, icon: const Icon(Icons.call_rounded), onPressed: () => launchUrl(Uri.parse('tel:911'))),
            ),
            ListTile(
              leading: const Icon(Icons.emergency_rounded, color: RafeeqColors.danger, size: 32),
              title: Text(t.ambulance997),
              trailing: IconButton.filled(tooltip: t.call, icon: const Icon(Icons.call_rounded), onPressed: () => launchUrl(Uri.parse('tel:997'))),
            ),
          ]),
        ),
        ListTile(
          leading: const Icon(Icons.support_agent_rounded, size: 32, color: RafeeqColors.brand700),
          title: Text(t.ptLostFound),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/map?type=lost_and_found'),
        ),
        SectionTitle(t.helpArticles),
        AsyncView(
          value: help,
          onRetry: () => ref.invalidate(helpProvider),
          builder: (list) => Column(children: [
            for (final a in list)
              ExpansionTile(
                title: Text(a['title'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                children: [Text((a['body'] as String?) ?? '')],
              ),
          ]),
        ),
      ]),
    );
  }
}
