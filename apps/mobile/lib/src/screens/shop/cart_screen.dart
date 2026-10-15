import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';
import 'cart.dart';

/// Cart and delivery: to the hotel, or shipped home with the full price (shipping by
/// weight and country) shown before payment.
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  String _delivery = 'hotel';
  final _room = TextEditingController();
  final _country = TextEditingController();
  final _line1 = TextEditingController();
  final _city = TextEditingController();
  final _postcode = TextEditingController();
  final _message = TextEditingController();
  bool _giftWrap = false;
  Map<String, dynamic>? _quote;
  Object? _quoteError;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_room, _country, _line1, _city, _postcode, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _deliveryBody() => _delivery == 'hotel'
      ? {'deliveryType': 'hotel', if (_room.text.trim().isNotEmpty) 'room': _room.text.trim()}
      : {
          'deliveryType': 'international',
          'country': _country.text.trim().toUpperCase(),
          'line1': _line1.text.trim(),
          'city': _city.text.trim(),
          if (_postcode.text.trim().isNotEmpty) 'postcode': _postcode.text.trim(),
        };

  List<Map<String, dynamic>> _items() => [for (final i in ref.read(cartProvider)) {'productId': i.productId, 'quantity': i.quantity}];

  Future<void> _getQuote() async {
    setState(() {
      _busy = true;
      _quoteError = null;
    });
    try {
      final q = await ref.read(apiProvider).post('/orders/quote', {'items': _items(), 'delivery': _deliveryBody(), 'giftWrap': _giftWrap}) as Map;
      setState(() => _quote = Map<String, dynamic>.from(q));
    } catch (e) {
      setState(() {
        _quote = null;
        _quoteError = e;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _order() async {
    setState(() => _busy = true);
    try {
      final o = await ref.read(apiProvider).post('/orders', {
        'items': _items(),
        'delivery': _deliveryBody(),
        'giftWrap': _giftWrap,
        if (_giftWrap && _message.text.trim().isNotEmpty) 'giftMessage': _message.text.trim(),
      }) as Map;
      ref.read(cartProvider.notifier).clear();
      if (mounted) context.pushReplacement('/checkout?order=${o['id']}');
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _warning(String code) {
    final t = l10n(context);
    return switch (code) {
      'may_arrive_after_departure' => t.warnLate,
      'customs_may_apply' => t.customsNote,
      _ => code,
    };
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final cart = ref.watch(cartProvider);
    final notifier = ref.read(cartProvider.notifier);
    final hotel = ref.watch(sessionProvider).me?.hotel;
    final warnings = (_quote?['warnings'] as List? ?? const []).map((w) => (w as Map)['code'] as String).toSet();
    return Scaffold(
      appBar: AppBar(title: Text(t.cart)),
      body: cart.isEmpty
          ? Center(child: Text(t.cartEmpty))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(cart.first.shopName, style: Theme.of(context).textTheme.titleMedium),
                for (final i in cart)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(i.title),
                    subtitle: Text(Fmt.sar(i.priceHalalas * i.quantity, lang)),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(tooltip: t.less, onPressed: () => setState(() {
                            notifier.setQuantity(i.productId, i.quantity - 1);
                            _quote = null;
                          }), icon: const Icon(Icons.remove_circle_outline)),
                      Text('${i.quantity}', style: const TextStyle(fontSize: 18)),
                      IconButton(tooltip: t.more, onPressed: () => setState(() {
                            notifier.setQuantity(i.productId, i.quantity + 1);
                            _quote = null;
                          }), icon: const Icon(Icons.add_circle_outline)),
                    ]),
                  ),
                SectionTitle(t.delivery),
                SegmentedButton<String>(
                  segments: [ButtonSegment(value: 'hotel', label: Text(t.toMyHotel)), ButtonSegment(value: 'international', label: Text(t.shipHome))],
                  selected: {_delivery},
                  onSelectionChanged: (s) => setState(() {
                    _delivery = s.first;
                    _quote = null;
                  }),
                ),
                const SizedBox(height: 12),
                if (_delivery == 'hotel') ...[
                  Text(hotel == null ? t.setHotelFirst : pick(hotel['name'], lang)),
                  TextField(controller: _room, decoration: InputDecoration(labelText: t.room)),
                ] else ...[
                  TextField(controller: _country, maxLength: 2, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(labelText: t.countryCode, helperText: t.countryHint)),
                  TextField(controller: _line1, decoration: InputDecoration(labelText: t.address)),
                  TextField(controller: _city, decoration: InputDecoration(labelText: t.city)),
                  TextField(controller: _postcode, decoration: InputDecoration(labelText: t.postcode)),
                ],
                SwitchListTile(contentPadding: EdgeInsets.zero, value: _giftWrap, onChanged: (v) => setState(() {
                      _giftWrap = v;
                      _quote = null;
                    }), title: Text(t.giftWrap)),
                if (_giftWrap) TextField(controller: _message, maxLength: 200, decoration: InputDecoration(labelText: t.giftMessage)),
                const SizedBox(height: 12),
                if (_quoteError != null) Text(errorText(context, _quoteError!), style: const TextStyle(color: RafeeqColors.danger)),
                if (_quote != null)
                  Card(
                    color: RafeeqColors.brand100,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(children: [
                        InfoRow(t.subtotal, Fmt.sar(_quote!['subtotalHalalas'] as int, lang)),
                        InfoRow(t.delivery, (_quote!['shippingHalalas'] as int) == 0 ? t.free : Fmt.sar(_quote!['shippingHalalas'] as int, lang)),
                        if ((_quote!['giftWrapHalalas'] as int) > 0) InfoRow(t.giftWrap, Fmt.sar(_quote!['giftWrapHalalas'] as int, lang)),
                        InfoRow(t.total, Fmt.sar(_quote!['totalHalalas'] as int, lang)),
                        InfoRow(t.arrivesIn, t.days(_quote!['estimatedDays'] as int)),
                        for (final w in warnings) Padding(padding: const EdgeInsets.only(top: 6), child: Text('⚠ ${_warning(w)}')),
                      ]),
                    ),
                  ),
                const SizedBox(height: 12),
                if (_quote == null)
                  FilledButton(onPressed: _busy ? null : _getQuote, child: Text(t.seeTotal))
                else
                  FilledButton(onPressed: _busy ? null : _order, child: Text(t.continueToPay)),
              ],
            ),
    );
  }
}
