import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Bookings tab: upcoming and past service bookings, and gift orders. Opens from the
/// phone's cache when there is no network.
class BookingsScreen extends ConsumerWidget {
  const BookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: heroAppBar(
          title: t.tabBookings,
          bottom: heroTabBar(
            tabs: [
              Tab(text: t.upcoming),
              Tab(text: t.past),
              Tab(text: t.orders),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _BookingList(scope: 'upcoming'),
            _BookingList(scope: 'past'),
            _OrderList(),
          ],
        ),
      ),
    );
  }
}

class _BookingList extends ConsumerWidget {
  const _BookingList({required this.scope});
  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final list = ref.watch(myBookingsProvider(scope));
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(myBookingsProvider(scope)),
      child: AsyncView(
        value: list,
        onRetry: () => ref.invalidate(myBookingsProvider(scope)),
        builder: (c) => ListView(
          children: [
            StaleBanner(cached: c),
            if (c.data.isEmpty)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Text(t.noBookings, textAlign: TextAlign.center),
              ),
            for (final b in c.data)
              Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: ListTile(
                  leading: Icon(categoryIcon(b['category'] as String), color: RafeeqColors.brand700, size: 32),
                  title: Text(b['title'] as String),
                  subtitle: Text('${Fmt.dateTime(b['startsAt'] as String?, lang)}\n${b['provider']}'),
                  isThreeLine: true,
                  trailing: StatusChip(b['status'] as String),
                  onTap: () => context.push('/booking/${b['id']}'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _OrderList extends ConsumerWidget {
  const _OrderList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final list = ref.watch(myOrdersProvider);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(myOrdersProvider),
      child: AsyncView(
        value: list,
        onRetry: () => ref.invalidate(myOrdersProvider),
        builder: (c) => ListView(
          children: [
            StaleBanner(cached: c),
            if (c.data.isEmpty)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Text(t.noOrders, textAlign: TextAlign.center),
              ),
            for (final o in c.data)
              Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: ListTile(
                  leading: const Icon(Icons.card_giftcard_rounded, color: RafeeqColors.brand700, size: 32),
                  title: Text(o['shop'] as String),
                  subtitle: Text('${Fmt.dateTime(o['createdAt'] as String, lang)} · ${Fmt.sar(o['totalHalalas'] as int, lang)}'),
                  trailing: StatusChip(o['status'] as String),
                  onTap: () => context.push('/order/${o['id']}'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
