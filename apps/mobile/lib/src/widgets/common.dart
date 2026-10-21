import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../api/client.dart';
import '../theme.dart';

export 'motifs.dart';

AppLocalizations l10n(BuildContext context) => AppLocalizations.of(context);

/// Translate an API error code (e.g. booking.not_enough_capacity) for the user.
String errorText(BuildContext context, Object error) {
  final t = l10n(context);
  if (error is ApiException) {
    if (error.offline) return t.errOffline;
    return switch (error.code) {
      'auth.wrong_code' => t.errWrongCode,
      'auth.code_expired' => t.errCodeExpired,
      'auth.locked' || 'auth.too_many_codes' => t.errTooMany,
      'auth.invalid_phone' => t.errPhone,
      'auth.invalid_email' => t.errEmail,
      'booking.not_enough_capacity' || 'booking.slot_unavailable' => t.errSlotFull,
      'booking.hold_expired' => t.errHoldExpired,
      'booking.cannot_cancel' || 'booking.already_started' => t.errCannotCancel,
      'payment.unknown_test_card' => t.errTestCard,
      'order.out_of_stock' => t.errOutOfStock,
      'order.country_not_allowed' || 'order.not_shippable' || 'order.country_not_served' => t.errCountry,
      'order.no_hotel' => t.errNoHotel,
      'order.one_shop' => t.errOneShop,
      'location.no_consent' => t.errNoConsent,
      'location.no_group' => t.errNoGroup,
      'group.not_found' => t.errGroupCode,
      'review.exists' => t.errReviewed,
      _ => t.errGeneric(error.code),
    };
  }
  return t.errGeneric('app');
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorText(context, error)), backgroundColor: RafeeqColors.danger));
}

void showDone(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

/// Loading / error / data for a FutureProvider, with a retry button and "updated N min ago".
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.value, required this.builder, this.onRetry});

  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: builder,
      loading: () => const Center(
        child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_rounded, size: 56, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 12),
              Text(errorText(context, e), textAlign: TextAlign.center),
              if (onRetry != null) ...[const SizedBox(height: 12), OutlinedButton(onPressed: onRetry, child: Text(l10n(context).retry))],
            ],
          ),
        ),
      ),
    );
  }
}

/// Shown when data came from the phone's cache because the network is down.
class StaleBanner extends StatelessWidget {
  const StaleBanner({super.key, required this.cached});
  final Cached<dynamic> cached;

  @override
  Widget build(BuildContext context) {
    if (!cached.fromCache) return const SizedBox.shrink();
    final minutes = DateTime.now().difference(cached.savedAt).inMinutes;
    return Container(
      width: double.infinity,
      color: const Color(0xFFFBF1D9),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.history_rounded, size: 20, color: RafeeqColors.gold700),
          const SizedBox(width: 8),
          Expanded(child: Text(l10n(context).updatedAgo(minutes))),
        ],
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final (Color bg, Color fg) = switch (status) {
      'completed' || 'paid_out' || 'delivered' || 'stored' || 'found' || 'resolved' => (RafeeqColors.brand100, RafeeqColors.brand900),
      'accepted' || 'in_progress' || 'in_transit' || 'out_for_delivery' || 'shipped' => (const Color(0xFFDCEBFA), const Color(0xFF0B3D6B)),
      'declined' || 'disputed' || 'overdue' || 'lost' || 'open' => (RafeeqColors.clay100, RafeeqColors.clay700),
      'cancelled' || 'refunded' => (RafeeqColors.sand200, RafeeqColors.ink600),
      _ => (const Color(0xFFFBF1D9), RafeeqColors.gold700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            statusLabel(t, status),
            style: TextStyle(color: fg, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

String statusLabel(AppLocalizations t, String s) => switch (s) {
  'pending_payment' => t.stPendingPayment,
  'paid' => t.stPaid,
  'accepted' => t.stAccepted,
  'in_progress' => t.stInProgress,
  'completed' => t.stCompleted,
  'paid_out' => t.stCompleted,
  'declined' => t.stDeclined,
  'cancelled' => t.stCancelled,
  'refunded' => t.stRefunded,
  'disputed' => t.stDisputed,
  'packed' => t.stPacked,
  'out_for_delivery' => t.stOutForDelivery,
  'shipped' => t.stShipped,
  'delivered' => t.stDelivered,
  'tagged' => t.stTagged,
  'in_transit' => t.stInTransit,
  'stored' => t.stStored,
  'overdue' => t.stOverdue,
  'lost' => t.stLost,
  'found' => t.stFound,
  _ => s,
};

String categoryLabel(AppLocalizations t, String c) => switch (c) {
  'transport' => t.catTransport,
  'guides' => t.catGuides,
  'photography' => t.catPhotography,
  'luggage' => t.catLuggage,
  'accessibility' => t.catAccessibility,
  'heritage_tours' => t.catHeritage,
  _ => c,
};

IconData categoryIcon(String c) => switch (c) {
  'transport' => Icons.directions_bus_rounded,
  'guides' => Icons.tour_rounded,
  'photography' => Icons.photo_camera_rounded,
  'luggage' => Icons.luggage_rounded,
  'accessibility' => Icons.accessible_forward_rounded,
  'heritage_tours' => Icons.fort_rounded,
  _ => Icons.miscellaneous_services_rounded,
};

String sectionLabel(AppLocalizations t, String s) => switch (s) {
  'makkah_gifts' => t.secMakkah,
  'madinah_gifts' => t.secMadinah,
  'dates' => t.secDates,
  _ => s,
};

String handoverLabel(AppLocalizations t, String p) => switch (p) {
  'hotel_lobby' => t.hoHotel,
  'van' => t.hoVan,
  'storage_room' => t.hoStorage,
  'shipping_depot' => t.hoDepot,
  'airport_counter' => t.hoAirport,
  'checked_in' => t.hoCheckedIn,
  'madinah_hotel_lobby' => t.hoMadinahHotel,
  'handed_to_pilgrim' => t.hoHanded,
  _ => p,
};

/// A labelled service icon, used on Home, the Guide tab and in accessibility mode.
/// No box around it: the icon sits on a soft eight-point star in its category colour,
/// with the label underneath, straight on the white page.
class BigTile extends StatelessWidget {
  const BigTile({super.key, required this.icon, required this.label, required this.onTap, this.color, this.tint});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  /// Icon colour; defaults to the flag green.
  final Color? color;

  /// The soft star behind the icon; defaults to a light green.
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final ink = color ?? RafeeqColors.brand700;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox.square(
                dimension: 72,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Positioned.fill(child: CustomPaint(painter: _StarFill(tint ?? RafeeqColors.brand100))),
                    Icon(icon, size: 36, color: ink),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, height: 1.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Filled eight-point star (two overlapping rounded squares).
class _StarFill extends CustomPainter {
  const _StarFill(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final c = size.center(Offset.zero);
    final side = size.width * 0.72;
    final square = RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: side, height: side), Radius.circular(side * 0.14));
    canvas.drawRRect(square, paint);
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(0.785398);
    canvas.translate(-c.dx, -c.dy);
    canvas.drawRRect(square, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_StarFill old) => old.color != color;
}

/// Outline eight-point star, used as a tile ornament.
class StarOrnament extends CustomPainter {
  const StarOrnament(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.05
      ..color = color;
    final c = size.center(Offset.zero);
    final r = size.width * 0.3;
    canvas.drawRect(Rect.fromCenter(center: c, width: r * 2, height: r * 2), paint);
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(0.785398);
    canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: r * 2, height: r * 2), paint);
    canvas.restore();
    canvas.drawCircle(c, r * 0.45, paint);
  }

  @override
  bool shouldRepaint(StarOrnament old) => old.color != color;
}


/// The next booking as a flat timeline row: a green rail with a gold dot, the caption,
/// title and time, and the status. No box: it sits on the page between hairlines.
class TicketCard extends StatelessWidget {
  const TicketCard({super.key, required this.icon, required this.title, required this.caption, required this.when, this.trailing, this.onTap});
  final IconData icon;
  final String title;
  final String caption;
  final String when;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 20,
                child: Column(
                  children: [
                    Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: RafeeqColors.gold500,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: const [BoxShadow(color: RafeeqColors.gold500, spreadRadius: 1)],
                      ),
                    ),
                    Expanded(child: Container(width: 3, color: RafeeqColors.brand700)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      caption.toUpperCase(),
                      style: const TextStyle(color: RafeeqColors.gold700, fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.6),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(icon, color: RafeeqColors.brand700, size: 22),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.schedule_rounded, color: RafeeqColors.ink600, size: 18),
                        const SizedBox(width: 6),
                        Expanded(child: Text(when, style: const TextStyle(color: RafeeqColors.ink600, fontWeight: FontWeight.w600))),
                        if (trailing != null) trailing!,
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsetsDirectional.fromSTEB(16, 24, 16, 10),
    child: Row(
      children: [
        ExcludeSemantics(
          child: Transform.rotate(
            angle: 0.785398, // 45°: a small gold diamond
            child: Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(color: RafeeqColors.gold500, borderRadius: BorderRadius.circular(2)),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.titleLarge)),
        if (trailing != null) trailing!,
      ],
    ),
  );
}

/// Label: value row for detail screens.
class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 120, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
        Expanded(child: Text(value)),
      ],
    ),
  );
}
