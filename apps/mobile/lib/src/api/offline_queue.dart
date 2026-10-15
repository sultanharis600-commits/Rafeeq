import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'client.dart';

/// Actions taken without network (bag scans, location points, lost alerts) wait here and
/// are sent when the connection returns. Each keeps the time it happened, not the time
/// it was sent. Bag scans carry a clientId so a retried batch is stored once.
class OfflineQueue extends StateNotifier<List<QueuedAction>> {
  OfflineQueue(this._api, this._prefs) : super(_load(_prefs)) {
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) flush();
    });
  }

  final Api _api;
  final SharedPreferences _prefs;
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _flushing = false;
  static const _key = 'offline_queue_v1';

  static List<QueuedAction> _load(SharedPreferences p) {
    final raw = p.getString(_key);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).map((e) => QueuedAction.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> _save() => _prefs.setString(_key, jsonEncode(state.map((a) => a.toJson()).toList()));

  Future<void> add(QueuedAction action) async {
    state = [...state, action];
    await _save();
    unawaited(flush());
  }

  /// Drop everything of one kind that hasn't been sent (e.g. a lost alert cancelled offline).
  Future<void> removeKind(String kind) async {
    state = state.where((a) => a.kind != kind).toList();
    await _save();
  }

  /// Send everything waiting. Bag scans go as one batch; failures stay queued unless the
  /// server rejected them for good (then they are dropped and reported in [rejected]).
  final List<String> rejected = [];

  Future<void> flush() async {
    if (_flushing || state.isEmpty) return;
    _flushing = true;
    try {
      final scans = state.where((a) => a.kind == 'bag_scan').toList();
      if (scans.isNotEmpty) {
        try {
          final results = await _api.post('/staff/bag-scans', {'scans': scans.map((s) => s.body).toList()}) as List;
          final done = <String>{};
          for (final r in results.cast<Map>()) {
            final id = r['clientId'] as String?;
            if (id == null) continue;
            done.add(id);
            if (r['ok'] != true) rejected.add('${r['tagCode']}: ${r['error']}');
          }
          state = state.where((a) => !(a.kind == 'bag_scan' && done.contains(a.body['clientId']))).toList();
          await _save();
        } on ApiException catch (e) {
          if (!e.offline) rethrow;
        }
      }
      final points = state.where((a) => a.kind == 'location').toList();
      if (points.isNotEmpty) {
        try {
          await _api.post('/locations', {'points': points.map((p) => p.body).toList()});
          state = state.where((a) => a.kind != 'location').toList();
          await _save();
        } on ApiException catch (e) {
          if (!e.offline) {
            // Consent off or no group: these points can't be stored; drop them.
            state = state.where((a) => a.kind != 'location').toList();
            await _save();
          }
        }
      }
      for (final a in state.where((a) => a.kind == 'lost_alert').toList()) {
        try {
          await _api.post('/lost-alerts', a.body);
          state = state.where((x) => x.id != a.id).toList();
          await _save();
        } on ApiException catch (e) {
          if (e.offline) break;
          state = state.where((x) => x.id != a.id).toList();
          await _save();
        }
      }
    } finally {
      _flushing = false;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

class QueuedAction {
  QueuedAction({required this.id, required this.kind, required this.body, required this.at});

  final String id;
  final String kind; // bag_scan | location | lost_alert
  final Map<String, dynamic> body;
  final DateTime at;

  Map<String, dynamic> toJson() => {'id': id, 'kind': kind, 'body': body, 'at': at.toIso8601String()};

  factory QueuedAction.fromJson(Map<String, dynamic> j) =>
      QueuedAction(id: j['id'] as String, kind: j['kind'] as String, body: Map<String, dynamic>.from(j['body'] as Map), at: DateTime.parse(j['at'] as String));
}

final offlineQueueProvider = StateNotifierProvider<OfflineQueue, List<QueuedAction>>(
  (ref) => OfflineQueue(ref.watch(apiProvider), ref.watch(prefsProvider)),
);
