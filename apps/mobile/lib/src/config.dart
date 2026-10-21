import 'package:flutter/foundation.dart';

/// Build-time settings, passed with --dart-define. Defaults suit the Android emulator
/// talking to a local API.
abstract final class Config {
  static const _apiUrlDefine = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000');

  /// API base URL, without /v1.
  /// On Flutter web, `10.0.2.2` is rewritten to `127.0.0.1` — that alias only works
  /// inside the Android emulator, and the browser cancels those requests.
  static String get apiUrl {
    if (kIsWeb) return _apiUrlDefine.replaceAll('10.0.2.2', '127.0.0.1');
    return _apiUrlDefine;
  }

  /// Demo mode: sandbox payments and sample data. On until the compliance checklist is done.
  static const demoMode = bool.fromEnvironment('RAFEEQ_DEMO_MODE', defaultValue: true);

  /// Number that receives "RFQ LOST lat,lng" texts and forwards them to the API webhook.
  /// In demo mode a test number.
  static const lostSmsNumber = String.fromEnvironment('RAFEEQ_SMS_NUMBER', defaultValue: '+966500000099');

  /// Bluetooth service UUID every Rafeeq phone advertises for the nearby finder.
  static const bleServiceUuid = '8d1f0001-5a3b-4c2e-9f1d-52af0c1e7a11';

  /// How often the app records the last known location while sharing is on.
  static const locationInterval = Duration(minutes: 2);
}
