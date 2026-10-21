import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Services in a category (or matching a search), with a "speaks my language" filter.
class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key, this.category, this.query});
  final String? category;
  final String? query;

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  bool _myLanguage = false;

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final q = ServiceQuery(category: widget.category, q: widget.query, language: _myLanguage ? lang : null);
    final services = ref.watch(servicesProvider(q));
    final title = widget.category != null ? categoryLabel(t, widget.category!) : t.searchResults(widget.query ?? '');
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(children: [
        if (widget.category == 'heritage_tours')
          Card(
            margin: const EdgeInsets.all(12),
            child: ListTile(leading: const Icon(Icons.info_outline), title: Text(t.zuyarahNote)),
          ),
        SwitchListTile(value: _myLanguage, onChanged: (v) => setState(() => _myLanguage = v), title: Text(t.speaksMyLanguage)),
        Expanded(
          child: AsyncView(
            value: services,
            onRetry: () => ref.invalidate(servicesProvider(q)),
            builder: (list) => list.isEmpty
                ? Center(child: Text(t.nothingFound))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: list.length,
                    itemBuilder: (_, i) => _ServiceCard(s: list[i], lang: lang),
                  ),
          ),
        ),
      ]),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.s, required this.lang});
  final Json s;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final rating = s['rating'] as Map;
    final provider = s['provider'] as Map;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.push('/service/${s['id']}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s['title'] as String, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.verified_rounded, size: 18, color: RafeeqColors.brand500),
              const SizedBox(width: 4),
              Expanded(child: Text(provider['name'] as String, style: Theme.of(context).textTheme.bodySmall)),
              if (rating['average'] != null) ...[
                const Icon(Icons.star_rounded, size: 18, color: RafeeqColors.gold500),
                Text(' ${rating['average']} (${rating['count']})'),
              ],
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Text(Fmt.sar(s['priceHalalas'] as int, lang), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: RafeeqColors.brand900)),
              Text(' / ${priceModelLabel(t, s['priceModel'] as String)}'),
              const Spacer(),
              Text((s['languagesSpoken'] as List).map((l) => (l as String).toUpperCase()).join(' · '), style: Theme.of(context).textTheme.bodySmall),
            ]),
            if (s['nextAvailable'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(t.nextFree(Fmt.dateTime(s['nextAvailable'] as String, lang)), style: Theme.of(context).textTheme.bodySmall),
              ),
          ]),
        ),
      ),
    );
  }
}

String priceModelLabel(AppLocalizations t, String m) => switch (m) {
      'per_trip' => t.perTrip,
      'per_hour' => t.perHour,
      'per_person' => t.perPerson,
      'per_bag' => t.perBag,
      'per_tag' => t.perTag,
      _ => t.perBooking,
    };
