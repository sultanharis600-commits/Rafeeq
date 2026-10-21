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
        appBar: heroAppBar(
          title: t.tabShop,
          actions: [HeroIconButton(tooltip: t.cart, icon: Icons.shopping_bag_rounded, badge: count, onPressed: () => context.push('/cart'))],
          bottom: heroTabBar(isScrollable: true, tabs: [for (final s in sections) Tab(text: sectionLabel(t, s))]),
        ),
        body: Column(
          children: [
            if (shopId != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: InputChip(avatar: const Icon(Icons.storefront_rounded), label: Text(t.oneShopOnly), onDeleted: () => context.go('/shop')),
              ),
            Expanded(
              child: TabBarView(
                children: [for (final s in sections) _Products(section: s, shopId: shopId)],
              ),
            ),
          ],
        ),
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
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: a11y ? 1 : 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: a11y ? 2.6 : 0.72,
        ),
        itemCount: list.length,
        itemBuilder: (_, i) {
          final p = list[i];
          final grad = switch (section) {
            'dates' => RafeeqColors.tileBrown,
            'madinah_gifts' => RafeeqColors.tileGreen,
            _ => RafeeqColors.tileAmber,
          };
          final art = Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: grad, begin: AlignmentDirectional.topStart, end: AlignmentDirectional.bottomEnd),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Positioned.fill(
                  child: ExcludeSemantics(child: CustomPaint(painter: KhatimPattern(cell: 28, opacity: 0.18))),
                ),
                PositionedDirectional(
                  end: -20,
                  bottom: -20,
                  child: ExcludeSemantics(
                    child: SizedBox.square(dimension: 90, child: CustomPaint(painter: StarOrnament(Colors.white.withValues(alpha: 0.16)))),
                  ),
                ),
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white38),
                  ),
                  child: Icon(section == 'dates' ? Icons.spa_rounded : Icons.redeem_rounded, size: 34, color: Colors.white),
                ),
              ],
            ),
          );
          final info = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                p['title'] as String,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, height: 1.2),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.storefront_rounded, size: 15, color: RafeeqColors.ink600),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      (p['shop'] as Map)['name'] as String,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: RafeeqColors.brand100, borderRadius: BorderRadius.circular(10)),
                        child: Text(
                          Fmt.sar(p['priceHalalas'] as int, lang),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: RafeeqColors.brand900),
                        ),
                      ),
                    ),
                  ),
                  if (p['inStock'] != true)
                    Text(
                      t.outOfStock,
                      style: const TextStyle(color: RafeeqColors.clay700, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                ],
              ),
            ],
          );
          // No box: the product picture and its text sit straight on the page.
          return Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => context.push('/product/${p['id']}'),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: a11y
                    ? Row(
                        children: [
                          AspectRatio(aspectRatio: 1, child: art),
                          const SizedBox(width: 12),
                          Expanded(child: info),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(flex: 5, child: art),
                          const SizedBox(height: 10),
                          Expanded(flex: 5, child: info),
                        ],
                      ),
              ),
            ),
          );
        },
      ),
    );
  }
}
