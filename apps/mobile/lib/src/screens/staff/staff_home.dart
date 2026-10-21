import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/offline_queue.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Staff mode (same app, staff login): today's jobs and the bag scanner.
class StaffHome extends ConsumerWidget {
  const StaffHome({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final lang = session.locale?.languageCode ?? 'en';
    final jobs = ref.watch(staffJobsProvider);
    final waiting = ref.watch(offlineQueueProvider).where((a) => a.kind == 'bag_scan').length;

    return Scaffold(
      appBar: heroAppBar(
        title: t.todaysJobs,
        actions: [HeroIconButton(tooltip: t.signOut, icon: Icons.logout_rounded, onPressed: () => ref.read(sessionProvider.notifier).logout())],
      ),
      floatingActionButton: FloatingActionButton.large(
        tooltip: t.scanBags,
        onPressed: () => context.push('/staff/scan'),
        child: const Icon(Icons.qr_code_scanner_rounded, size: 40),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(offlineQueueProvider.notifier).flush();
          ref.invalidate(staffJobsProvider);
        },
        child: AsyncView(
          value: jobs,
          onRetry: () => ref.invalidate(staffJobsProvider),
          builder: (c) => ListView(
            padding: const EdgeInsets.only(bottom: 120),
            children: [
              StaleBanner(cached: c),
              ListTile(
                leading: const CircleAvatar(child: Icon(Icons.badge_rounded)),
                title: Text(session.me!.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(t.staffMode),
              ),
              if (waiting > 0)
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  color: RafeeqColors.gold500.withValues(alpha: 0.2),
                  child: ListTile(leading: const Icon(Icons.cloud_upload_rounded), title: Text(t.scansWaiting(waiting))),
                ),
              if (c.data.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(t.noJobsToday, textAlign: TextAlign.center),
                ),
              for (final j in c.data)
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(12),
                    leading: Icon(categoryIcon(j['category'] as String), size: 36, color: RafeeqColors.brand700),
                    title: Text(j['title'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${Fmt.time(j['startsAt'] as String?, lang)} · ${(j['pilgrim'] as Map)['name']}'),
                        if ((j['needs'] as List?)?.isNotEmpty ?? false)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(
                              children: [
                                const Icon(Icons.accessible_rounded, size: 18, color: RafeeqColors.danger),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(t.hasNeeds, style: const TextStyle(color: RafeeqColors.danger)),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    trailing: StatusChip(j['status'] as String),
                    onTap: () => context.push('/staff/job/${j['id']}'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
