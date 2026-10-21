import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data.dart';
import '../../session.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Onboarding step 3: city, hotel and travel dates. Step 4 (group, accessibility) is
/// offered at the end and can be skipped.
class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  String _city = 'makkah';
  String? _hotelId;
  DateTimeRange? _dates;
  bool _accessibility = false;
  bool _busy = false;

  Future<void> _save() async {
    if (_hotelId == null) return;
    setState(() => _busy = true);
    try {
      final s = ref.read(sessionProvider.notifier);
      await s.updateProfile({
        'city': _city,
        'hotelPlaceId': _hotelId,
        if (_dates != null) 'travelFrom': _dates!.start.toUtc().toIso8601String(),
        if (_dates != null) 'travelTo': _dates!.end.toUtc().toIso8601String(),
      });
      if (_accessibility) await s.setAccessibility(true);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final hotels = ref.watch(hotelsProvider(_city));
    return Scaffold(
      appBar: AppBar(title: Text(t.setupTitle)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(t.setupIntro),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'makkah', label: Text(t.makkah)),
              ButtonSegment(value: 'madinah', label: Text(t.madinah)),
            ],
            selected: {_city},
            onSelectionChanged: (s) => setState(() {
              _city = s.first;
              _hotelId = null;
            }),
          ),
          const SizedBox(height: 16),
          Text(t.yourHotel, style: Theme.of(context).textTheme.titleMedium),
          AsyncView(
            value: hotels,
            onRetry: () => ref.invalidate(hotelsProvider(_city)),
            builder: (list) => Column(children: [
              for (final h in list)
                ListTile(
                  leading: Icon(_hotelId == h['id'] ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded),
                  selected: _hotelId == h['id'],
                  onTap: () => setState(() => _hotelId = h['id'] as String),
                  title: Text(h['name'] as String),
                ),
            ]),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.date_range_rounded),
            label: Text(_dates == null ? t.travelDates : '${Fmt.day(_dates!.start, lang)} – ${Fmt.day(_dates!.end, lang)}'),
            onPressed: () async {
              final now = DateTime.now();
              final r = await showDateRangePicker(context: context, firstDate: now.subtract(const Duration(days: 30)), lastDate: now.add(const Duration(days: 365)));
              if (r != null) setState(() => _dates = r);
            },
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            value: _accessibility,
            onChanged: (v) => setState(() => _accessibility = v),
            title: Text(t.accessibilityMode),
            subtitle: Text(t.accessibilityModeHint),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: _hotelId == null || _busy ? null : _save, child: Text(t.continueButton)),
        ],
      ),
    );
  }
}
