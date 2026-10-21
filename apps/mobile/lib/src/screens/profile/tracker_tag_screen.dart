import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Tracker tag setup guide (guide: Lost Companion, part 1) for pilgrims who may not use a
/// phone. The tag is found through Apple Find My or Google Find My Device by the family
/// member who set it up; Rafeeq records which member carries which tag so the group knows.
class TrackerTagScreen extends ConsumerStatefulWidget {
  const TrackerTagScreen({super.key});

  @override
  ConsumerState<TrackerTagScreen> createState() => _TrackerTagScreenState();
}

class _TrackerTagScreenState extends ConsumerState<TrackerTagScreen> {
  final _label = TextEditingController();

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  Future<void> _save(String groupId) async {
    final t = l10n(context);
    try {
      await ref.read(apiProvider).patch('/groups/$groupId/members/me', {'trackerTag': _label.text.trim().isEmpty ? null : _label.text.trim()});
      ref.invalidate(groupsProvider);
      if (mounted) showDone(context, t.saved);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final me = ref.watch(sessionProvider).me!;
    final groups = ref.watch(groupsProvider);
    final steps = [t.tagStep1, t.tagStep2, t.tagStep3, t.tagStep4];

    return Scaffold(
      appBar: AppBar(title: Text(t.trackerTag)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(t.tagIntro, style: const TextStyle(fontSize: 18)),
        const SizedBox(height: 16),
        for (var i = 0; i < steps.length; i++)
          ListTile(
            leading: CircleAvatar(backgroundColor: RafeeqColors.brand700, foregroundColor: Colors.white, child: Text('${i + 1}')),
            title: Text(steps[i]),
          ),
        const SizedBox(height: 8),
        Text(t.tagPrivacy, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          icon: const Icon(Icons.sell_rounded),
          label: Text(t.rentTag),
          onPressed: () => context.go('/home/services?category=accessibility'),
        ),
        const Divider(height: 32),
        Text(t.tagRecord, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        groups.maybeWhen(
          data: (c) {
            if (c.data.isEmpty) return Text(t.lostNoGroup);
            final g = c.data.first;
            final mine = asList(g['members']).where((m) => m['userId'] == me.id).firstOrNull;
            if (_label.text.isEmpty && mine?['trackerTag'] != null) _label.text = mine!['trackerTag'] as String;
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              TextField(controller: _label, decoration: InputDecoration(labelText: t.tagLabel, hintText: 'AirTag · ${me.name.split(' ').first}')),
              const SizedBox(height: 8),
              FilledButton(onPressed: () => _save(g['id'] as String), child: Text(t.save)),
            ]);
          },
          orElse: () => const LinearProgressIndicator(),
        ),
      ]),
    );
  }
}
