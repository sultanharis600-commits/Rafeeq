import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/client.dart';
import 'session.dart';

/// Read-side providers. Lists the pilgrim needs offline (bookings, orders, group, map
/// pack) go through [Api.cachedGet] so they open without network.

typedef Json = Map<String, dynamic>;

Json asJson(Object? o) => Map<String, dynamic>.from(o as Map);
List<Json> asList(Object? o) => (o as List).map(asJson).toList();

String _lang(Ref ref) => ref.watch(sessionProvider).locale?.languageCode ?? 'en';

final categoriesProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final city = ref.watch(sessionProvider).me?.city;
  return asList(await ref.watch(apiProvider).get('/categories', query: {'city': city}));
});

final bannersProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final c = await ref.watch(apiProvider).cachedGet('/content', query: {'kind': 'banner', 'lang': _lang(ref), 'city': ref.watch(sessionProvider).me?.city});
  return asList(c.data);
});

final helpProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final c = await ref.watch(apiProvider).cachedGet('/content', query: {'kind': 'help', 'lang': _lang(ref)});
  return asList(c.data);
});

/// Search: category + optional text + language spoken.
class ServiceQuery {
  const ServiceQuery({this.category, this.q, this.language});
  final String? category;
  final String? q;
  final String? language;

  @override
  bool operator ==(Object other) => other is ServiceQuery && other.category == category && other.q == q && other.language == language;
  @override
  int get hashCode => Object.hash(category, q, language);
}

final servicesProvider = FutureProvider.autoDispose.family<List<Json>, ServiceQuery>((ref, q) async {
  final me = ref.watch(sessionProvider).me;
  final res = await ref.watch(apiProvider).get('/services', query: {
    'category': q.category,
    'q': q.q,
    'language': q.language,
    'city': me?.city,
    'lang': _lang(ref),
    'limit': 50,
  });
  return asList((res as Map)['items']);
});

final serviceProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async {
  return asJson(await ref.watch(apiProvider).get('/services/$id', query: {'lang': _lang(ref)}));
});

final myBookingsProvider = FutureProvider.autoDispose.family<Cached<List<Json>>, String>((ref, scope) async {
  final c = await ref.watch(apiProvider).cachedGet('/bookings', query: {'scope': scope, 'limit': 50});
  return Cached(asList((c.data as Map)['items']), c.savedAt, fromCache: c.fromCache);
});

final bookingProvider = FutureProvider.autoDispose.family<Cached<Json>, String>((ref, id) async {
  final c = await ref.watch(apiProvider).cachedGet('/bookings/$id', query: {'lang': _lang(ref)});
  return Cached(asJson(c.data), c.savedAt, fromCache: c.fromCache);
});

final alternativesProvider = FutureProvider.autoDispose.family<List<Json>, String>((ref, id) async {
  return asList(await ref.watch(apiProvider).get('/bookings/$id/alternatives'));
});

final bagProvider = FutureProvider.autoDispose.family<Cached<Json>, String>((ref, id) async {
  final c = await ref.watch(apiProvider).cachedGet('/bags/$id');
  return Cached(asJson(c.data), c.savedAt, fromCache: c.fromCache);
});

/// Products in a section, optionally from one shop only (the places guide's "Shop online").
final productsProvider = FutureProvider.autoDispose.family<List<Json>, ({String section, String? shopId})>((ref, k) async {
  final res = await ref.watch(apiProvider).get('/products', query: {'section': k.section, 'shopId': k.shopId, 'lang': _lang(ref), 'limit': 100});
  return asList((res as Map)['items']);
});

final productProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async {
  return asJson(await ref.watch(apiProvider).get('/products/$id', query: {'lang': _lang(ref)}));
});

final myOrdersProvider = FutureProvider.autoDispose<Cached<List<Json>>>((ref) async {
  final c = await ref.watch(apiProvider).cachedGet('/orders', query: {'limit': 50});
  return Cached(asList((c.data as Map)['items']), c.savedAt, fromCache: c.fromCache);
});

final orderProvider = FutureProvider.autoDispose.family<Cached<Json>, String>((ref, id) async {
  final c = await ref.watch(apiProvider).cachedGet('/orders/$id', query: {'lang': _lang(ref)});
  return Cached(asJson(c.data), c.savedAt, fromCache: c.fromCache);
});

final groupsProvider = FutureProvider.autoDispose<Cached<List<Json>>>((ref) async {
  final c = await ref.watch(apiProvider).cachedGet('/groups');
  return Cached(asList(c.data), c.savedAt, fromCache: c.fromCache);
});

final contactsProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  return asList(await ref.watch(apiProvider).get('/me/emergency-contacts'));
});

final hotelsProvider = FutureProvider.autoDispose.family<List<Json>, String>((ref, city) async {
  return asList(await ref.watch(apiProvider).get('/places', query: {'city': city, 'type': 'hotel', 'lang': _lang(ref)}));
});

final staffJobsProvider = FutureProvider.autoDispose<Cached<List<Json>>>((ref) async {
  final c = await ref.watch(apiProvider).cachedGet('/staff/jobs');
  return Cached(asList(c.data), c.savedAt, fromCache: c.fromCache);
});

/// The offline map pack for a city: every place and walking route with all languages.
/// Downloaded once and kept on the phone; refreshed when the server's version changes.
final mapPackProvider = FutureProvider.family<Json, String>((ref, city) async {
  final prefs = ref.watch(prefsProvider);
  final key = 'map_pack_$city';
  try {
    final pack = asJson(await ref.watch(apiProvider).get('/map-packs/$city'));
    await prefs.setString(key, jsonEncode(pack));
    return pack;
  } on ApiException catch (e) {
    final saved = prefs.getString(key);
    if (e.offline && saved != null) return asJson(jsonDecode(saved));
    rethrow;
  }
});
