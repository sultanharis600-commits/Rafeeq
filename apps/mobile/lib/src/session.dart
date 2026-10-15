import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api/client.dart';

/// Launch languages, in the order shown on the language choice screen.
const supportedLanguageCodes = ['ar', 'en', 'ur', 'id', 'ms', 'tr'];
const rtlLanguages = {'ar', 'ur'};

/// The signed-in user as returned by GET /me.
class Me {
  Me(this.json);
  final Map<String, dynamic> json;

  String get id => json['id'] as String;
  String get name => json['name'] as String;
  String get role => json['role'] as String;
  String get language => json['language'] as String;
  bool get accessibilityMode => json['accessibilityMode'] as bool? ?? false;
  List<String> get needs => (json['accessibilityNeeds'] as List? ?? const []).cast<String>();
  String? get city => json['city'] as String?;
  Map<String, dynamic>? get hotel => json['hotel'] as Map<String, dynamic>?;
  bool get sharesLocation => json['locationSharingAt'] != null;
  bool get isStaff => role == 'staff';
  bool get isPilgrim => role == 'pilgrim';
  bool get setupDone => city != null && hotel != null;
}

/// App-wide state: language, accessibility mode, login token and the current user.
@immutable
class SessionState {
  const SessionState({this.locale, this.token, this.me, this.accessibilityMode = false, this.loading = true});

  final Locale? locale;
  final String? token;
  final Me? me;
  final bool accessibilityMode;
  final bool loading;

  bool get loggedIn => token != null && me != null;

  SessionState copyWith({Locale? locale, String? token, Me? me, bool? accessibilityMode, bool? loading, bool clearUser = false}) => SessionState(
        locale: locale ?? this.locale,
        token: clearUser ? null : (token ?? this.token),
        me: clearUser ? null : (me ?? this.me),
        accessibilityMode: accessibilityMode ?? this.accessibilityMode,
        loading: loading ?? this.loading,
      );
}

class Session extends StateNotifier<SessionState> {
  Session(this._api, this._ref) : super(const SessionState()) {
    _restore();
  }

  final Api _api;
  final Ref _ref;
  static const _storage = FlutterSecureStorage();

  Future<void> _restore() async {
    final prefs = _ref.read(prefsProvider);
    final lang = prefs.getString('language');
    final a11y = prefs.getBool('accessibility') ?? false;
    final token = await _storage.read(key: 'token');
    state = state.copyWith(locale: lang == null ? null : Locale(lang), accessibilityMode: a11y);
    _api.language = lang;
    if (token != null) {
      _api.token = token;
      try {
        final me = Me(Map<String, dynamic>.from(await _api.get('/me') as Map));
        state = state.copyWith(token: token, me: me, accessibilityMode: me.accessibilityMode || a11y);
      } on ApiException catch (e) {
        if (e.offline) {
          // Offline at start: keep the user signed in with the cached profile.
          final cached = prefs.getString('me');
          if (cached != null) state = state.copyWith(token: token, me: Me(Map<String, dynamic>.from(_decode(cached))));
        } else {
          await _storage.delete(key: 'token');
          _api.token = null;
        }
      }
    }
    state = state.copyWith(loading: false);
  }

  Future<void> chooseLanguage(String code) async {
    assert(supportedLanguageCodes.contains(code));
    await _ref.read(prefsProvider).setString('language', code);
    _api.language = code;
    state = state.copyWith(locale: Locale(code));
    if (state.loggedIn) await updateProfile({'language': code});
  }

  Future<void> setAccessibility(bool on) async {
    await _ref.read(prefsProvider).setBool('accessibility', on);
    state = state.copyWith(accessibilityMode: on);
    if (state.loggedIn) await updateProfile({'accessibilityMode': on});
  }

  /// Returns the demo code in demo mode.
  Future<String?> requestCode(String phone) async {
    final res = await _api.post('/auth/otp/request', {'phone': phone, 'language': state.locale?.languageCode ?? 'en'}) as Map;
    return res['demoCode'] as String?;
  }

  Future<void> verify(String phone, String code, {String? name}) async {
    final res = await _api.post('/auth/otp/verify', {
      'phone': phone,
      'code': code,
      if (name != null && name.isNotEmpty) 'name': name,
      'language': state.locale?.languageCode ?? 'en',
    }) as Map;
    final token = res['token'] as String;
    await _storage.write(key: 'token', value: token);
    _api.token = token;
    await refresh();
    state = state.copyWith(token: token);
  }

  /// Testing only: does the API allow logging in without a code? (GET /config)
  Future<bool> quickLoginEnabled() async {
    try {
      final cfg = await _api.get('/config') as Map;
      return cfg['quickLogin'] == true;
    } on ApiException {
      return false;
    }
  }

  /// Testing only: phone number or email, no code. The API refuses this outside demo mode.
  Future<void> quickLogin(String identifier, {String? name}) async {
    final res = await _api.post('/auth/quick-login', {
      'identifier': identifier,
      if (name != null && name.isNotEmpty) 'name': name,
      'language': state.locale?.languageCode ?? 'en',
    }) as Map;
    final token = res['token'] as String;
    await _storage.write(key: 'token', value: token);
    _api.token = token;
    await refresh();
    state = state.copyWith(token: token);
  }

  Future<void> refresh() async {
    final json = Map<String, dynamic>.from(await _api.get('/me') as Map);
    await _ref.read(prefsProvider).setString('me', _encode(json));
    final me = Me(json);
    state = state.copyWith(me: me, token: _api.token, accessibilityMode: me.accessibilityMode || state.accessibilityMode);
  }

  Future<void> updateProfile(Map<String, dynamic> patch) async {
    final json = Map<String, dynamic>.from(await _api.patch('/me', patch) as Map);
    await _ref.read(prefsProvider).setString('me', _encode(json));
    state = state.copyWith(me: Me(json));
  }

  Future<void> logout() async {
    await _storage.delete(key: 'token');
    _api.token = null;
    state = state.copyWith(clearUser: true);
  }

  static String _encode(Map<String, dynamic> j) => jsonEncode(j);
  static Map _decode(String s) => jsonDecode(s) as Map;
}

final sessionProvider = StateNotifierProvider<Session, SessionState>((ref) => Session(ref.watch(apiProvider), ref));
