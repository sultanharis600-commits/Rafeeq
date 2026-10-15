import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../session.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import '../bookings/booking_screen.dart' show openInvoice, ReviewSheet;

class OrderScreen extends ConsumerWidget {
  const OrderScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final order = ref.watch(orderProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(t.order)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(orderProvider(id)),
        child: AsyncView(
          value: order,
          onRetry: () => ref.invalidate(orderProvider(id)),
          builder: (c) {
            final o = c.data;
            final status = o['status'] as String;
            final address = o['address'] as Map;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                StaleBanner(cached: c),
                Text((o['shop'] as Map)['name'] as String, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                StatusChip(status),
                const SizedBox(height: 12),
                for (final i in asList(o['items'])) InfoRow('${i['quantity']} ×', i['title'] as String),
                const Divider(),
                InfoRow(t.delivery, (o['shippingHalalas'] as int) == 0 ? t.free : Fmt.sar(o['shippingHalalas'] as int, lang)),
                InfoRow(t.total, Fmt.sar(o['totalHalalas'] as int, lang)),
                InfoRow(
                  t.deliverTo,
                  address['kind'] == 'hotel' ? ((o['hotel'] as Map?)?['name'] as String? ?? '') : '${address['line1']}, ${address['city']}, ${address['country']}',
                ),
                if (o['trackingNumber'] != null) InfoRow(t.tracking, '${o['courier']} · ${o['trackingNumber']}'),
                SectionTitle(t.history),
                for (final h in asList(o['history']))
                  ListTile(dense: true, leading: const Icon(Icons.check_circle_outline), title: Text(statusLabel(t, h['to'] as String)), subtitle: Text(Fmt.dateTime(h['at'] as String, lang))),
                const SizedBox(height: 12),
                if (status == 'pending_payment') FilledButton(onPressed: () => context.push('/checkout?order=$id'), child: Text(t.pay)),
                if (status != 'pending_payment') OutlinedButton.icon(icon: const Icon(Icons.receipt_long), label: Text(t.invoice), onPressed: () => openInvoice(context, ref, 'orders', id)),
                if (status == 'delivered')
                  FilledButton.icon(
                    icon: const Icon(Icons.star),
                    label: Text(t.leaveReview),
                    onPressed: () async {
                      final r = await showModalBottomSheet<(int, String)>(context: context, isScrollControlled: true, builder: (_) => const ReviewSheet());
                      if (r == null || !context.mounted) return;
                      try {
                        await ref.read(apiProvider).post('/reviews', {'orderId': id, 'rating': r.$1, if (r.$2.isNotEmpty) 'text': r.$2});
                        if (context.mounted) showDone(context, t.thanksReview);
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                  ),
                if (status == 'paid')
                  TextButton(
                    onPressed: () async {
                      try {
                        await ref.read(apiProvider).post('/orders/$id/cancel', {});
                        ref.invalidate(orderProvider(id));
                        ref.invalidate(myOrdersProvider);
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: Text(t.cancelOrder),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
