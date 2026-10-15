import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../api/client.dart';
import '../theme.dart';

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
      loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.cloud_off, size: 48, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(errorText(context, e), textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: Text(l10n(context).retry)),
            ],
          ]),
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
      color: RafeeqColors.gold500.withValues(alpha: 0.2),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(l10n(context).updatedAgo(minutes)),
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
      'declined' || 'disputed' || 'overdue' || 'lost' || 'open' => (const Color(0xFFFBE4E2), RafeeqColors.danger),
      'cancelled' || 'refunded' => (RafeeqColors.sand300, RafeeqColors.ink600),
      _ => (RafeeqColors.gold500.withValues(alpha: 0.2), RafeeqColors.ink900),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(statusLabel(t, status), style: TextStyle(color: fg, fontWeight: FontWeight.w600)),
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
      'transport' => Icons.airport_shuttle,
      'guides' => Icons.record_voice_over,
      'photography' => Icons.photo_camera,
      'luggage' => Icons.luggage,
      'accessibility' => Icons.accessible,
      'heritage_tours' => Icons.account_balance,
      _ => Icons.miscellaneous_services,
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

/// A big, labelled tile used on Home and in accessibility mode.
class BigTile extends StatelessWidget {
  const BigTile({super.key, required this.icon, required this.label, required this.onTap, this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: RafeeqColors.sand300)),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 36, color: color ?? RafeeqColors.brand700),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ]),
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
        padding: const EdgeInsetsDirectional.fromSTEB(16, 20, 16, 8),
        child: Row(children: [
          Expanded(child: Text(text, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
          if (trailing != null) trailing!,
        ]),
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
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          Expanded(child: Text(value)),
        ]),
      );
}
