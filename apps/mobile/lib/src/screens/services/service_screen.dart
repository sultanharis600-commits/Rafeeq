import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import '../home/services_screen.dart';

/// Booking screen 1 of 3: service details with full price, refund policy and verified badge.
class ServiceScreen extends ConsumerWidget {
  const ServiceScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final service = ref.watch(serviceProvider(id));
    return Scaffold(
      appBar: AppBar(),
      body: AsyncView(
        value: service,
        onRetry: () => ref.invalidate(serviceProvider(id)),
        builder: (s) {
          final provider = s['provider'] as Map;
          final rating = s['rating'] as Map;
          final reviews = asList(s['reviews']);
          final options = asList(s['options']);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(s['title'] as String, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.verified, color: RafeeqColors.brand500),
                const SizedBox(width: 6),
                Expanded(child: Text('${provider['name']} · ${t.verified}')),
              ]),
              if (rating['average'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('★ ${rating['average']} · ${t.reviewsCount(rating['count'] as int)}'),
                ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${Fmt.sar(s['priceHalalas'] as int, lang)} / ${priceModelLabel(t, s['priceModel'] as String)}',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: RafeeqColors.brand900)),
                    Text(t.vatIncluded, style: Theme.of(context).textTheme.bodySmall),
                    if (s['durationMinutes'] != null) InfoRow(t.duration, t.minutes(s['durationMinutes'] as int)),
                    InfoRow(t.languages, (s['languagesSpoken'] as List).map((l) => (l as String).toUpperCase()).join(' · ')),
                    InfoRow(t.cancellation, policyLabel(t, s['cancellationPolicy'] as String)),
                  ]),
                ),
              ),
              if ((s['description'] as String).isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(s['description'] as String, style: Theme.of(context).textTheme.bodyLarge),
              ],
              if (options.isNotEmpty) ...[
                SectionTitle(t.extras),
                for (final o in options) ListTile(title: Text(o['title'] as String), trailing: Text('+ ${Fmt.sar(o['priceHalalas'] as int, lang)}')),
              ],
              if (reviews.isNotEmpty) ...[
                SectionTitle(t.reviews),
                for (final r in reviews.take(5))
                  ListTile(
                    leading: Text('★' * (r['rating'] as int), style: const TextStyle(color: RafeeqColors.gold500)),
                    title: Text((r['text'] as String?) ?? '', textDirection: rtlLanguages.contains(r['language']) ? TextDirection.rtl : TextDirection.ltr),
                    subtitle: Text(r['author'] as String),
                  ),
              ],
              const SizedBox(height: 80),
            ],
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(onPressed: () => context.push('/service/$id/book'), child: Text(t.chooseTime)),
        ),
      ),
    );
  }
}

String policyLabel(dynamic t, String p) => switch (p) {
      'moderate' => t.policyModerate as String,
      'strict' => t.policyStrict as String,
      _ => t.policyFlexible as String,
    };
