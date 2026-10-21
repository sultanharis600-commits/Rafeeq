import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/client.dart';
import '../../config.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import '../guide/map_screen.dart' show osmTiles;

/// One booking: status, who is coming (with live location), bags, cancel, dispute,
/// review and the invoice.
class BookingScreen extends ConsumerWidget {
  const BookingScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final booking = ref.watch(bookingProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(t.booking)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(bookingProvider(id)),
        child: AsyncView(
          value: booking,
          onRetry: () => ref.invalidate(bookingProvider(id)),
          builder: (c) {
            final b = c.data;
            final service = b['service'] as Map;
            final status = b['status'] as String;
            final staff = b['staff'] as Map?;
            final live = b['liveLocation'] as Map?;
            final bags = asList(b['bags']);
            final cancel = b['cancel'] as Map?;
            return ListView(
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                StaleBanner(cached: c),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(service['title'] as String, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    StatusChip(status),
                    const SizedBox(height: 12),
                    InfoRow(t.when, Fmt.dateTime((b['slot'] as Map?)?['startsAt'] as String?, lang)),
                    InfoRow(t.provider, (b['provider'] as Map)['name'] as String),
                    if (b['meetingPoint'] != null) InfoRow(t.meetingPoint, b['meetingPoint'] as String),
                    InfoRow(t.total, Fmt.sar(b['totalHalalas'] as int, lang)),
                    if (status == 'paid') Padding(padding: const EdgeInsets.only(top: 8), child: Text(t.waitingForProvider)),
                  ]),
                ),
                if (staff != null)
                  Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12),
                    child: ListTile(
                      leading: const Icon(Icons.badge_rounded, size: 32, color: RafeeqColors.brand700),
                      title: Text(staff['name'] as String),
                      subtitle: Text(staff['vehicle'] as String? ?? ''),
                      trailing: staff['phone'] == null
                          ? null
                          : IconButton.filled(tooltip: t.call, icon: const Icon(Icons.call_rounded), onPressed: () => launchUrl(Uri.parse('tel:${staff['phone']}'))),
                    ),
                  ),
                if (live != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SizedBox(
                        height: 220,
                        child: FlutterMap(
                          options: MapOptions(initialCenter: LatLng((live['lat'] as num).toDouble(), (live['lng'] as num).toDouble()), initialZoom: 15),
                          children: [
                            osmTiles(),
                            MarkerLayer(markers: [
                              Marker(
                                point: LatLng((live['lat'] as num).toDouble(), (live['lng'] as num).toDouble()),
                                width: 44,
                                height: 44,
                                child: const Icon(Icons.directions_car_rounded, color: RafeeqColors.brand900, size: 40),
                              ),
                            ]),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (bags.isNotEmpty) ...[
                  SectionTitle(t.yourBags),
                  for (final g in bags)
                    ListTile(
                      leading: const Icon(Icons.luggage_rounded, size: 32),
                      title: Text((g['label'] as String?) ?? g['tagCode'] as String),
                      subtitle: Text(g['tagCode'] as String),
                      trailing: StatusChip(g['status'] as String),
                      onTap: () => context.push('/bag/${g['id']}'),
                    ),
                ],
                SectionTitle(t.history),
                for (final h in asList(b['history']))
                  ListTile(dense: true, leading: const Icon(Icons.check_circle_outline), title: Text(statusLabel(t, h['to'] as String)), subtitle: Text(Fmt.dateTime(h['at'] as String, lang))),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    if (status == 'pending_payment') FilledButton(onPressed: () => context.push('/checkout?booking=$id'), child: Text(t.pay)),
                    if (['declined', 'refunded'].contains(status)) _Alternatives(id: id),
                    if (['completed', 'paid_out'].contains(status)) _ReviewButton(bookingId: id),
                    if (status != 'pending_payment' && status != 'cancelled')
                      OutlinedButton.icon(
                        icon: const Icon(Icons.receipt_long_rounded),
                        label: Text(t.invoice),
                        onPressed: () => openInvoice(context, ref, 'bookings', id),
                      ),
                    if (cancel != null && cancel['allowed'] == true) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(foregroundColor: RafeeqColors.danger),
                        onPressed: () => _cancel(context, ref, cancel['refundHalalas'] as int, lang),
                        child: Text(t.cancelBooking),
                      ),
                    ],
                    if (['accepted', 'in_progress', 'completed'].contains(status)) TextButton(onPressed: () => _dispute(context, ref), child: Text(t.reportProblem)),
                  ]),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref, int refund, String lang) async {
    final t = l10n(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.cancelBooking),
        content: Text(refund > 0 ? t.cancelRefund(Fmt.sar(refund, lang)) : t.cancelNoRefund),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t.keepBooking)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t.cancelBooking)),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(apiProvider).post('/bookings/$id/cancel', {});
      ref.invalidate(bookingProvider(id));
      ref.invalidate(myBookingsProvider);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _dispute(BuildContext context, WidgetRef ref) async {
    final t = l10n(context);
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.reportProblem),
        content: TextField(controller: controller, maxLines: 3, decoration: InputDecoration(hintText: t.whatHappened)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t.back)),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: Text(t.send)),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty || !context.mounted) return;
    try {
      await ref.read(apiProvider).post('/bookings/$id/dispute', {'reason': reason});
      ref.invalidate(bookingProvider(id));
      if (context.mounted) showDone(context, t.problemSent);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

/// After a decline: the refund is automatic; offer similar services from others.
class _Alternatives extends ConsumerWidget {
  const _Alternatives({required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final alts = ref.watch(alternativesProvider(id));
    return Card(
      color: RafeeqColors.brand100,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t.declinedRefunded),
          ...alts.maybeWhen(
            data: (list) => [
              if (list.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(t.tryThese, style: const TextStyle(fontWeight: FontWeight.w700))),
              for (final a in list.take(3))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(a['title'] as String),
                  subtitle: Text('${a['provider']} · ${Fmt.dateTime(a['startsAt'] as String, lang)}'),
                  trailing: Text(Fmt.sar(a['priceHalalas'] as int, lang)),
                  onTap: () => context.push('/service/${a['serviceId']}'),
                ),
            ],
            orElse: () => <Widget>[],
          ),
        ]),
      ),
    );
  }
}

class _ReviewButton extends ConsumerWidget {
  const _ReviewButton({required this.bookingId});
  final String bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    return FilledButton.icon(
      icon: const Icon(Icons.star_rounded),
      label: Text(t.leaveReview),
      onPressed: () async {
        final result = await showModalBottomSheet<(int, String)>(context: context, isScrollControlled: true, builder: (_) => const ReviewSheet());
        if (result == null || !context.mounted) return;
        try {
          await ref.read(apiProvider).post('/reviews', {'bookingId': bookingId, 'rating': result.$1, if (result.$2.isNotEmpty) 'text': result.$2});
          if (context.mounted) showDone(context, t.thanksReview);
        } catch (e) {
          if (context.mounted) showError(context, e);
        }
      },
    );
  }
}

class ReviewSheet extends StatefulWidget {
  const ReviewSheet({super.key});

  @override
  State<ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<ReviewSheet> {
  int _rating = 5;
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(t.leaveReview, style: Theme.of(context).textTheme.titleLarge),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 1; i <= 5; i++)
            IconButton(
              iconSize: 40,
              tooltip: t.stars(i),
              icon: Icon(i <= _rating ? Icons.star_rounded : Icons.star_border_rounded, color: RafeeqColors.gold500),
              onPressed: () => setState(() => _rating = i),
            ),
        ]),
        TextField(controller: _text, maxLines: 3, decoration: InputDecoration(hintText: t.reviewHint)),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => Navigator.pop(context, (_rating, _text.text.trim())), child: Text(t.send)),
      ]),
    );
  }
}

/// Opens the sample PDF invoice in the browser through a short-lived link (the login
/// token never leaves the app).
Future<void> openInvoice(BuildContext context, WidgetRef ref, String kind, String id) async {
  try {
    final res = await ref.read(apiProvider).post('/$kind/$id/invoice-link') as Map;
    await launchUrl(Uri.parse('${Config.apiUrl}${res['path']}'), mode: LaunchMode.externalApplication);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}
