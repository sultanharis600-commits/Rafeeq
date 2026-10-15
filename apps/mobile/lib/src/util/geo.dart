import 'dart:math' as math;

/// The Kaaba, for the Qibla direction.
const kaabaLat = 21.422487;
const kaabaLng = 39.826206;

double _rad(double d) => d * math.pi / 180;

/// Great-circle bearing in degrees from north (0–360).
double bearing(double lat1, double lng1, double lat2, double lng2) {
  final y = math.sin(_rad(lng2 - lng1)) * math.cos(_rad(lat2));
  final x = math.cos(_rad(lat1)) * math.sin(_rad(lat2)) - math.sin(_rad(lat1)) * math.cos(_rad(lat2)) * math.cos(_rad(lng2 - lng1));
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}

double qiblaBearing(double lat, double lng) => bearing(lat, lng, kaabaLat, kaabaLng);

/// Distance in metres.
double distanceM(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371000.0;
  final dLat = _rad(lat2 - lat1);
  final dLng = _rad(lng2 - lng1);
  final a = math.pow(math.sin(dLat / 2), 2) + math.cos(_rad(lat1)) * math.cos(_rad(lat2)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.sqrt(a));
}

/// Rough distance from Bluetooth signal strength (RSSI). Only good enough for
/// "warmer / colder": crowds and bodies absorb the signal.
double rssiToMetres(int rssi, {int txPowerAt1m = -59}) => math.pow(10, (txPowerAt1m - rssi) / 20).toDouble();

/// Text the lost person's phone sends by SMS when there is signal but no data.
/// Two parts: a human message for the leader, and a line the Rafeeq SMS number can parse.
String lostSms({required String name, double? lat, double? lng, double? accuracyM, required String template}) {
  final where = (lat != null && lng != null) ? 'https://maps.google.com/?q=${lat.toStringAsFixed(5)},${lng.toStringAsFixed(5)}' : '—';
  final human = template.replaceAll('%name%', name).replaceAll('%map%', where);
  final machine = (lat != null && lng != null) ? 'RFQ LOST ${lat.toStringAsFixed(5)},${lng.toStringAsFixed(5)} ${accuracyM?.round() ?? 0}' : 'RFQ LOST';
  return '$human\n$machine';
}
