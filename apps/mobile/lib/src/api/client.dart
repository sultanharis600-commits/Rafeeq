import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// An API error with the stable `code` the app translates (see l10n `err_*`).
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, [this.details]);
  final int status;
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  /// No response: offline or the server is unreachable.
  bool get offline => status == 0;

  @override
  String toString() => 'ApiException($status, $code, $message)';
}

/// A cached response and how old it is ("updated 4 min ago" instead of endless spinners).
class Cached<T> {
  Cached(this.data, this.savedAt, {this.fromCache = false});
  final T data;
  final DateTime savedAt;
  final bool fromCache;
}

/// Thin client over the Rafeeq REST API. GET responses can be cached on the phone so
/// screens open instantly near the Haram, where the network is often overloaded.
class Api {
  Api(this._prefs, {String? token}) : _token = token {
    _dio = Dio(BaseOptions(
      baseUrl: '${Config.apiUrl}/v1',
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Accept': 'application/json'},
    ));
  }

  final SharedPreferences _prefs;
  late final Dio _dio;
  String? _token;
  String? language;

  set token(String? t) => _token = t;
  String? get token => _token;

  Map<String, String> get _headers => {
        if (_token != null) 'Authorization': 'Bearer $_token',
        if (language != null) 'Accept-Language': language!,
      };

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body ?? const {});
  Future<dynamic> patch(String path, Object body) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, {Map<String, dynamic>? query, Object? body}) async {
    try {
      final res = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query == null ? null : (Map<String, dynamic>.of(query)..removeWhere((_, v) => v == null)),
        options: Options(method: method, headers: _headers),
      );
      return res.data;
    } on DioException catch (e) {
      final r = e.response;
      if (r == null) throw ApiException(0, 'network.offline', e.message ?? 'offline');
      final data = r.data is Map ? r.data as Map : const {};
      final msg = data['message'];
      throw ApiException(
        r.statusCode ?? 0,
        (data['code'] as String?) ?? 'http.${r.statusCode}',
        msg is List ? msg.join('; ') : (msg?.toString() ?? ''),
        data['details'] is Map ? Map<String, dynamic>.from(data['details'] as Map) : null,
      );
    }
  }

  /// GET with an offline fallback: on success the response is stored; when the network
  /// fails, the last stored copy is returned with its age.
  Future<Cached<dynamic>> cachedGet(String path, {Map<String, dynamic>? query}) async {
    final key = 'cache:${_token?.hashCode ?? 0}:$path?${jsonEncode(query ?? {})}';
    try {
      final data = await get(path, query: query);
      final now = DateTime.now();
      await _prefs.setString(key, jsonEncode({'at': now.toIso8601String(), 'data': data}));
      return Cached(data, now);
    } on ApiException catch (e) {
      final saved = _prefs.getString(key);
      if (e.offline && saved != null) {
        final j = jsonDecode(saved) as Map<String, dynamic>;
        return Cached(j['data'], DateTime.parse(j['at'] as String), fromCache: true);
      }
      rethrow;
    }
  }
}

/// Set in main() once SharedPreferences is ready.
final prefsProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError('prefsProvider is overridden in main'));

final apiProvider = Provider<Api>((ref) => Api(ref.watch(prefsProvider)));
