import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/client.dart';
import '../../data.dart';

/// The gifts cart, separate from service bookings. An order comes from one shop, so the
/// cart holds one shop at a time; adding from another shop asks to start a new cart.
class CartItem {
  CartItem({required this.productId, required this.title, required this.priceHalalas, required this.quantity, required this.shopId, required this.shopName});

  final String productId;
  final String title;
  final int priceHalalas;
  final int quantity;
  final String shopId;
  final String shopName;

  CartItem withQuantity(int q) => CartItem(productId: productId, title: title, priceHalalas: priceHalalas, quantity: q, shopId: shopId, shopName: shopName);

  Map<String, dynamic> toJson() => {'productId': productId, 'title': title, 'priceHalalas': priceHalalas, 'quantity': quantity, 'shopId': shopId, 'shopName': shopName};

  factory CartItem.fromJson(Json j) => CartItem(
        productId: j['productId'] as String,
        title: j['title'] as String,
        priceHalalas: j['priceHalalas'] as int,
        quantity: j['quantity'] as int,
        shopId: j['shopId'] as String,
        shopName: j['shopName'] as String,
      );
}

class Cart extends StateNotifier<List<CartItem>> {
  Cart(this._ref) : super(_load(_ref));

  final Ref _ref;
  static const _key = 'cart_v1';

  static List<CartItem> _load(Ref ref) {
    final raw = ref.read(prefsProvider).getString(_key);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).map((e) => CartItem.fromJson(asJson(e))).toList();
  }

  void _save() => _ref.read(prefsProvider).setString(_key, jsonEncode(state.map((e) => e.toJson()).toList()));

  String? get shopId => state.isEmpty ? null : state.first.shopId;

  int get subtotalHalalas => state.fold(0, (s, i) => s + i.priceHalalas * i.quantity);

  /// Returns false when the product is from another shop than the cart.
  bool add(Json product, int quantity) {
    final shop = product['shop'] as Map;
    if (shopId != null && shopId != shop['id']) return false;
    final existing = state.indexWhere((i) => i.productId == product['id']);
    if (existing >= 0) {
      final list = [...state];
      list[existing] = list[existing].withQuantity((list[existing].quantity + quantity).clamp(1, 50));
      state = list;
    } else {
      state = [
        ...state,
        CartItem(
          productId: product['id'] as String,
          title: product['title'] as String,
          priceHalalas: product['priceHalalas'] as int,
          quantity: quantity,
          shopId: shop['id'] as String,
          shopName: shop['name'] as String,
        ),
      ];
    }
    _save();
    return true;
  }

  void setQuantity(String productId, int quantity) {
    state = quantity <= 0
        ? state.where((i) => i.productId != productId).toList()
        : [for (final i in state) i.productId == productId ? i.withQuantity(quantity.clamp(1, 50)) : i];
    _save();
  }

  void clear() {
    state = [];
    _save();
  }
}

final cartProvider = StateNotifierProvider<Cart, List<CartItem>>((ref) => Cart(ref));
