import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import 'cart.dart';

const sections = ['makkah_gifts', 'madinah_gifts', 'dates'];

/// Shop tab: Makkah gifts, Madinah gifts and dates, delivered to the hotel or shipped home.
class ShopScreen extends ConsumerWidget {
  const ShopScreen({super.key, this.section, this.shopId});
  final String? section;

  /// Set when opened from a shopping place's "Shop online" button.
  final String? shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final cart = ref.watch(cartProvider);
    final count = cart.fold<int>(0, (s, i) => s + i.quantity);
    return DefaultTabController(
      length: sections.length,
      initialIndex: section == null ? 0 : sections.indexOf(section!).clamp(0, sections.length - 1),
      child: Scaffold(
        appBar: AppBar(
          title: Text(t.tabShop),
          actions: [
            IconButton(
              tooltip: t.cart,
              onPressed: () => context.push('/cart'),
              icon: Badge(isLabelVisible: count > 0, label: Text('$count'), child: const Icon(Icons.shopping_bag_outlined, size: 30)),
            ),
          ],
          bottom: TabBar(isScrollable: true, tabs: [for (final s in sections) Tab(text: sectionLabel(t, s))]),
        ),
        body: Column(children: [
          if (shopId != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: InputChip(
                avatar: const Icon(Icons.storefront),
                label: Text(t.oneShopOnly),
                onDeleted: () => context.go('/shop'),
              ),
            ),
          Expanded(child: TabBarView(children: [for (final s in sections) _Products(section: s, shopId: shopId)])),
        ]),
      ),
    );
  }
}

class _Products extends ConsumerWidget {
  const _Products({required this.section, this.shopId});
  final String section;
  final String? shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final a11y = ref.watch(sessionProvider).accessibilityMode;
    final key = (section: section, shopId: shopId);
    final products = ref.watch(productsProvider(key));
    return AsyncView(
      value: products,
      onRetry: () => ref.invalidate(productsProvider(key)),
      builder: (list) => GridView.builder(
        padding: const EdgeInsets.all(12),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: a11y ? 1 : 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: a11y ? 2.6 : 0.95),
        itemCount: list.length,
        itemBuilder: (_, i) {
          final p = list[i];
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => context.push('/product/${p['id']}'),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(section == 'dates' ? Icons.spa : Icons.card_giftcard, size: 36, color: RafeeqColors.gold500),
                  const SizedBox(height: 8),
                  Expanded(child: Text(p['title'] as String, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
                  Text((p['shop'] as Map)['name'] as String, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text(Fmt.sar(p['priceHalalas'] as int, lang), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: RafeeqColors.brand900)),
                  if (p['inStock'] != true) Text(t.outOfStock, style: const TextStyle(color: RafeeqColors.danger)),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}
