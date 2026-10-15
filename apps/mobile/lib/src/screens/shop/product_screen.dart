import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import 'cart.dart';

class ProductScreen extends ConsumerStatefulWidget {
  const ProductScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends ConsumerState<ProductScreen> {
  int _qty = 1;

  Future<void> _add(Json p) async {
    final t = l10n(context);
    final cart = ref.read(cartProvider.notifier);
    if (!cart.add(p, _qty)) {
      final start = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text(t.otherShopInCart),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t.back)),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t.startNewCart)),
          ],
        ),
      );
      if (start != true) return;
      cart.clear();
      cart.add(p, _qty);
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(t.addedToCart),
      action: SnackBarAction(label: t.cart, onPressed: () => context.push('/cart')),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final product = ref.watch(productProvider(widget.id));
    return Scaffold(
      appBar: AppBar(actions: [IconButton(tooltip: t.cart, onPressed: () => context.push('/cart'), icon: const Icon(Icons.shopping_bag_outlined))]),
      body: AsyncView(
        value: product,
        onRetry: () => ref.invalidate(productProvider(widget.id)),
        builder: (p) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(p['title'] as String, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text((p['shop'] as Map)['name'] as String),
            const SizedBox(height: 12),
            Text(Fmt.sar(p['priceHalalas'] as int, lang), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: RafeeqColors.brand900)),
            Text(t.vatIncluded, style: Theme.of(context).textTheme.bodySmall),
            if ((p['description'] as String).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(p['description'] as String)),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.local_shipping_outlined),
              title: Text(p['shipsAbroad'] == true ? t.shipsHome : t.hotelOnly),
              subtitle: (p['shipsToCountries'] as List).isEmpty ? null : Text((p['shipsToCountries'] as List).join(', ')),
            ),
            if (p['isFood'] == true) ListTile(leading: const Icon(Icons.info_outline), title: Text(t.customsNote)),
            const SizedBox(height: 12),
            Row(children: [
              IconButton.filledTonal(iconSize: 30, tooltip: t.less, onPressed: _qty > 1 ? () => setState(() => _qty--) : null, icon: const Icon(Icons.remove)),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Text('$_qty', style: const TextStyle(fontSize: 26))),
              IconButton.filledTonal(iconSize: 30, tooltip: t.more, onPressed: _qty < (p['stock'] as int) ? () => setState(() => _qty++) : null, icon: const Icon(Icons.add)),
            ]),
            const SizedBox(height: 16),
            FilledButton(onPressed: p['inStock'] == true ? () => _add(p) : null, child: Text(p['inStock'] == true ? t.addToCart : t.outOfStock)),
          ],
        ),
      ),
    );
  }
}
