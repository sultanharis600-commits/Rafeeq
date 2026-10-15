import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:flutter_ble_peripheral/flutter_ble_peripheral.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../config.dart';

/// Bluetooth nearby finder (guide: Lost Companion, part 4). Works with no network at all.
///
/// Every Rafeeq phone advertises the Rafeeq service UUID plus a rotating ID that changes
/// daily (from GET /me/ble-ids; no personal data). Group members get each other's IDs
/// ahead of time in the group data, so a family member can find the phone by signal
/// strength: warmer / colder.
///
/// The ID goes in two places because iOS can't advertise manufacturer data:
/// the local name "RFQ" + the first 12 hex characters (both platforms), and
/// manufacturer data 0xFFFF with all 8 bytes (Android).
class Ble {
  Ble(this._ref);
  final Ref _ref;
  final _peripheral = FlutterBlePeripheral();
  static const manufacturerId = 0xFFFF; // reserved for testing; register a company ID before launch
  static const _idsKey = 'ble_ids';

  /// Today's ID (Saudi date), from the server when online, else the copy on the phone.
  Future<String?> _todayId() async {
    final prefs = _ref.read(prefsProvider);
    try {
      final ids = await _ref.read(apiProvider).get('/me/ble-ids') as List;
      await prefs.setString(_idsKey, jsonEncode(ids));
    } on ApiException {
      // Offline: use the stored IDs.
    }
    final raw = prefs.getString(_idsKey);
    if (raw == null) return null;
    final today = DateTime.now().toUtc().add(const Duration(hours: 3)).toIso8601String().substring(0, 10);
    for (final e in (jsonDecode(raw) as List).cast<Map>()) {
      if (e['day'] == today) return e['id'] as String;
    }
    return null;
  }

  Future<void> startAdvertising() async {
    try {
      final id = await _todayId();
      if (id == null) return;
      if (!await _peripheral.isSupported) return;
      if (await _peripheral.isAdvertising) await _peripheral.stop();
      await _peripheral.start(
        advertiseData: AdvertiseData(
          serviceUuid: Config.bleServiceUuid,
          localName: 'RFQ${id.substring(0, 12)}',
          manufacturerId: Platform.isAndroid ? manufacturerId : null,
          manufacturerData: Platform.isAndroid ? _hexToBytes(id) : null,
        ),
      );
    } catch (_) {
      // Bluetooth off or not permitted: the finder simply won't see this phone.
    }
  }

  Future<void> stopAdvertising() async {
    try {
      await _peripheral.stop();
    } catch (_) {}
  }

  /// Signal strength readings for any of [ids] (that person's IDs for the coming days).
  Stream<int> scanFor(List<String> ids) {
    final controller = StreamController<int>();
    final prefixes = ids.map((i) => i.substring(0, 12).toLowerCase()).toSet();
    final full = ids.map((i) => i.toLowerCase()).toSet();
    StreamSubscription<List<ScanResult>>? sub;

    controller.onListen = () async {
      try {
        sub = FlutterBluePlus.onScanResults.listen((results) {
          for (final r in results) {
            if (_matches(r.advertisementData, prefixes, full)) controller.add(r.rssi);
          }
        });
        await FlutterBluePlus.startScan(
          withServices: [Guid(Config.bleServiceUuid)],
          continuousUpdates: true,
          removeIfGone: const Duration(seconds: 10),
          androidScanMode: AndroidScanMode.lowLatency,
        );
      } catch (e) {
        controller.addError(e);
      }
    };
    controller.onCancel = () async {
      await sub?.cancel();
      try {
        await FlutterBluePlus.stopScan();
      } catch (_) {}
    };
    return controller.stream;
  }

  static bool _matches(AdvertisementData a, Set<String> prefixes, Set<String> full) {
    final name = a.advName.toLowerCase();
    if (name.startsWith('rfq') && prefixes.contains(name.substring(3))) return true;
    final m = a.manufacturerData[manufacturerId];
    if (m != null && m.length == 8 && full.contains(_bytesToHex(m))) return true;
    return false;
  }

  static Uint8List _hexToBytes(String hex) =>
      Uint8List.fromList([for (var i = 0; i + 1 < hex.length; i += 2) int.parse(hex.substring(i, i + 2), radix: 16)]);

  static String _bytesToHex(List<int> b) => b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
}

final bleProvider = Provider<Ble>((ref) => Ble(ref));
