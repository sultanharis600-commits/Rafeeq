import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Booking screen 2 of 3: date and time, extras, quantity, meeting point and needs.
/// Creating the booking holds the place for 10 minutes while the pilgrim pays.
class BookScreen extends ConsumerStatefulWidget {
  const BookScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends ConsumerState<BookScreen> {
  String? _slotId;
  int _quantity = 1;
  final Set<String> _options = {};
  final _meeting = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _meeting.dispose();
    _notes.dispose();
    super.dispose();
  }

  bool _quantityAllowed(String model) => model != 'per_trip' && model != 'fixed';

  int _total(Json s) {
    final options = asList(s['options']).where((o) => _options.contains(o['key'])).fold<int>(0, (sum, o) => sum + (o['priceHalalas'] as int));
    return ((s['priceHalalas'] as int) + options) * _quantity;
  }

  Future<void> _book(Json s) async {
    setState(() => _busy = true);
    try {
      final me = ref.read(sessionProvider).me!;
      final booking = await ref.read(apiProvider).post('/bookings', {
        'serviceId': widget.id,
        'slotId': _slotId,
        'quantity': _quantity,
        'options': _options.toList(),
        if (_meeting.text.trim().isNotEmpty) 'meetingPoint': _meeting.text.trim(),
        if (_meeting.text.trim().isEmpty && me.hotel != null) 'meetingPoint': pick(me.hotel!['name'], me.language),
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
      }) as Map;
      if (mounted) context.pushReplacement('/checkout?booking=${booking['id']}');
    } catch (e) {
      if (mounted) showError(context, e);
      ref.invalidate(serviceProvider(widget.id));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final lang = session.locale?.languageCode ?? 'en';
    final service = ref.watch(serviceProvider(widget.id));
    return Scaffold(
      appBar: AppBar(title: Text(t.chooseTime)),
      body: AsyncView(
        value: service,
        builder: (s) {
          final slots = asList(s['slots']).where((x) => (x['remaining'] as int) > 0).toList();
          final byDay = <String, List<Json>>{};
          for (final x in slots) {
            final d = Fmt.saudi(DateTime.parse(x['startsAt'] as String));
            byDay.putIfAbsent(Fmt.day(d, lang), () => []).add(x);
          }
          final model = s['priceModel'] as String;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(s['title'] as String, style: Theme.of(context).textTheme.titleLarge),
              if (slots.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(t.noSlots)),
              for (final entry in byDay.entries) ...[
                SectionTitle(entry.key),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final x in entry.value)
                    ChoiceChip(
                      label: Text(Fmt.time(x['startsAt'] as String, lang), style: const TextStyle(fontSize: 18)),
                      selected: _slotId == x['id'],
                      onSelected: (_) => setState(() => _slotId = x['id'] as String),
                    ),
                ]),
              ],
              if (_quantityAllowed(model)) ...[
                SectionTitle(quantityLabel(t, model)),
                Row(children: [
                  IconButton.filledTonal(iconSize: 32, onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null, icon: const Icon(Icons.remove), tooltip: t.less),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text('$_quantity', style: const TextStyle(fontSize: 28))),
                  IconButton.filledTonal(iconSize: 32, onPressed: _quantity < 20 ? () => setState(() => _quantity++) : null, icon: const Icon(Icons.add), tooltip: t.more),
                ]),
              ],
              for (final o in asList(s['options']))
                CheckboxListTile(
                  value: _options.contains(o['key']),
                  onChanged: (v) => setState(() => v == true ? _options.add(o['key'] as String) : _options.remove(o['key'])),
                  title: Text(o['title'] as String),
                  secondary: Text('+ ${Fmt.sar(o['priceHalalas'] as int, lang)}'),
                ),
              const SizedBox(height: 8),
              TextField(controller: _meeting, decoration: InputDecoration(labelText: t.meetingPoint, helperText: t.meetingPointHint)),
              const SizedBox(height: 8),
              TextField(controller: _notes, maxLines: 2, decoration: InputDecoration(labelText: t.notesForProvider)),
              if (session.me!.needs.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(t.needsShared, style: Theme.of(context).textTheme.bodySmall),
                ),
              const SizedBox(height: 16),
              Card(
                color: RafeeqColors.brand100,
                child: ListTile(
                  title: Text(t.total),
                  subtitle: Text(t.vatIncluded),
                  trailing: Text(Fmt.sar(_total(s), lang), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(onPressed: _slotId == null || _busy ? null : () => _book(s), child: Text(t.continueToPay)),
            ],
          );
        },
      ),
    );
  }
}

String quantityLabel(dynamic t, String model) => switch (model) {
      'per_bag' => t.howManyBags as String,
      'per_person' => t.howManyPeople as String,
      'per_hour' => t.howManyHours as String,
      'per_tag' => t.howManyTags as String,
      _ => t.quantity as String,
    };
