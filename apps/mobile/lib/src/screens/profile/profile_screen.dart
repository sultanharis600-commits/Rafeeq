import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../api/client.dart';
import '../../lost/location_service.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

const accessibilityNeeds = ['wheelchair', 'walker', 'hard_of_hearing', 'low_vision', 'blind', 'memory_loss', 'other'];

String needLabel(AppLocalizations t, String n) => switch (n) {
  'wheelchair' => t.needWheelchair,
  'walker' => t.needWalker,
  'hard_of_hearing' => t.needHearing,
  'low_vision' => t.needLowVision,
  'blind' => t.needBlind,
  'memory_loss' => t.needMemory,
  _ => t.needOther,
};

/// Profile: language, accessibility mode and needs, location sharing (consent), travel
/// group, emergency contacts, tracker tag, help, my data, sign out.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final notifier = ref.read(sessionProvider.notifier);
    final me = session.me!;
    final lang = session.locale?.languageCode ?? 'en';

    Future<void> run(Future<void> Function() f) async {
      try {
        await f();
      } catch (e) {
        if (context.mounted) showError(context, e);
      }
    }

    return Scaffold(
      appBar: heroAppBar(title: t.tabProfile),
      body: ListView(
        children: [
          Card(
            margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: const BoxDecoration(gradient: RafeeqColors.goldGradient, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: Text(
                      me.name.trim().isEmpty ? '' : me.name.trim().characters.first.toUpperCase(),
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: RafeeqColors.brand950),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(me.name, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            const Icon(Icons.location_on_rounded, size: 16, color: RafeeqColors.gold700),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                [
                                  if (me.city != null) me.city == 'madinah' ? t.madinah : t.makkah,
                                  if (me.hotel != null) pick(me.hotel!['name'], lang),
                                ].join(' · '),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.language_rounded),
            title: Text(t.language),
            subtitle: Text(t.languageName),
            onTap: () => showModalBottomSheet<void>(
              context: context,
              builder: (_) => SafeArea(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final code in supportedLanguageCodes)
                      ListTile(
                        title: Text(lookupAppLocalizations(Locale(code)).languageName, style: const TextStyle(fontSize: 20)),
                        trailing: code == lang ? const Icon(Icons.check_rounded) : null,
                        onTap: () {
                          Navigator.of(context).pop();
                          run(() => notifier.chooseLanguage(code));
                        },
                      ),
                  ],
                ),
              ),
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.accessibility_new_rounded),
            title: Text(t.accessibilityMode),
            subtitle: Text(t.accessibilityModeHint),
            value: session.accessibilityMode,
            onChanged: (v) => run(() => notifier.setAccessibility(v)),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(72, 0, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.myNeeds, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    for (final n in accessibilityNeeds)
                      FilterChip(
                        label: Text(needLabel(t, n)),
                        selected: me.needs.contains(n),
                        onSelected: (on) => run(
                          () => notifier.updateProfile({
                            'accessibilityNeeds': on ? [...me.needs, n] : me.needs.where((x) => x != n).toList(),
                          }),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.share_location_rounded),
            title: Text(t.shareLocation),
            subtitle: Text(t.shareLocationHint),
            value: me.sharesLocation,
            onChanged: (on) async {
              if (on) {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: Text(t.shareLocation),
                    content: Text(t.locationConsent),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(c, false), child: Text(t.notNow)),
                      FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(t.agree)),
                    ],
                  ),
                );
                if (ok != true) return;
                if (!await LocationService.ensurePermission()) {
                  if (context.mounted) showDone(context, t.locationPermissionNeeded);
                  return;
                }
              }
              await run(() => notifier.updateProfile({'locationSharing': on}));
              final svc = ref.read(locationServiceProvider);
              svc.stop();
              await svc.start();
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.groups_rounded),
            title: Text(t.travelGroup),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/group'),
          ),
          ListTile(
            leading: const Icon(Icons.contact_phone_rounded),
            title: Text(t.emergencyContacts),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/contacts'),
          ),
          ListTile(
            leading: const Icon(Icons.sell_rounded),
            title: Text(t.trackerTag),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/tracker-tag'),
          ),
          ListTile(
            leading: const Icon(Icons.help_outline),
            title: Text(t.help),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/help'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.download_rounded),
            title: Text(t.downloadMyData),
            onTap: () => run(() async {
              final data = await ref.read(apiProvider).get('/me/export');
              final text = const JsonEncoder.withIndent('  ').convert(data);
              await Clipboard.setData(ClipboardData(text: text));
              if (context.mounted) showDone(context, t.dataCopied);
            }),
          ),
          ListTile(
            leading: const Icon(Icons.delete_forever_rounded, color: RafeeqColors.danger),
            title: Text(t.deleteAccount, style: const TextStyle(color: RafeeqColors.danger)),
            onTap: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (c) => AlertDialog(
                  title: Text(t.deleteAccount),
                  content: Text(t.deleteAccountWarning),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(c, false), child: Text(t.cancel)),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: RafeeqColors.danger),
                      onPressed: () => Navigator.pop(c, true),
                      child: Text(t.delete),
                    ),
                  ],
                ),
              );
              if (ok != true) return;
              await run(() async {
                await ref.read(apiProvider).delete('/me');
                await notifier.logout();
              });
            },
          ),
          ListTile(leading: const Icon(Icons.logout_rounded), title: Text(t.signOut), onTap: () => run(notifier.logout)),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
