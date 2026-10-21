import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../config.dart';
import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Booking screen 3 of 3 (also used for shop orders): pay with card, mada, Apple Pay or
/// STC Pay. In demo mode the gateway is a sandbox that accepts test cards.
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, this.bookingId, this.orderId});
  final String? bookingId;
  final String? orderId;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  String _method = 'mada';
  final _card = TextEditingController(text: '4111 1111 1111 1111');
  bool _busy = false;
  Json? _target;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _load();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _card.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = ref.read(apiProvider);
    final j = widget.bookingId != null ? await api.get('/bookings/${widget.bookingId}') : await api.get('/orders/${widget.orderId}');
    if (mounted) setState(() => _target = asJson(j));
  }

  Future<void> _pay() async {
    setState(() => _busy = true);
    final api = ref.read(apiProvider);
    try {
      final checkout = await api.post('/payments/checkout', {
        if (widget.bookingId != null) 'bookingId': widget.bookingId,
        if (widget.orderId != null) 'orderId': widget.orderId,
        'method': _method,
      }) as Map;
      final result = await api.post('/payments/${checkout['paymentId']}/sandbox/complete', {'cardNumber': _card.text}) as Map;
      if (!mounted) return;
      if (result['status'] == 'succeeded') {
        ref.invalidate(myBookingsProvider);
        ref.invalidate(myOrdersProvider);
        showDone(context, l10n(context).paid);
        context.pushReplacement(widget.bookingId != null ? '/booking/${widget.bookingId}' : '/order/${widget.orderId}');
      } else {
        showDone(context, l10n(context).paymentDeclined);
      }
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final lang = ref.watch(sessionProvider).locale?.languageCode ?? 'en';
    final target = _target;
    final holdUntil = target?['holdExpiresAt'] as String?;
    final left = holdUntil == null ? null : DateTime.parse(holdUntil).difference(DateTime.now());
    return Scaffold(
      appBar: AppBar(title: Text(t.pay)),
      body: target == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    title: Text(widget.bookingId != null ? (target['service'] as Map)['title'] as String : (target['shop'] as Map)['name'] as String),
                    subtitle: widget.bookingId != null ? Text(Fmt.dateTime((target['slot'] as Map?)?['startsAt'] as String?, lang)) : null,
                    trailing: Text(Fmt.sar(target['totalHalalas'] as int, lang), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  ),
                ),
                if (left != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      left.isNegative ? t.holdExpired : t.holdLeft('${left.inMinutes}:${(left.inSeconds % 60).toString().padLeft(2, '0')}'),
                      style: TextStyle(color: left.inMinutes < 2 ? RafeeqColors.danger : RafeeqColors.ink600),
                    ),
                  ),
                if (widget.bookingId != null)
                  Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t.refundPolicyShown, style: Theme.of(context).textTheme.bodySmall)),
                SectionTitle(t.payWith),
                for (final m in const ['mada', 'card', 'apple_pay', 'stc_pay'])
                  ListTile(
                    leading: Icon(_method == m ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded, color: RafeeqColors.brand700),
                    title: Text(methodLabel(t, m)),
                    onTap: () => setState(() => _method = m),
                  ),
                if (Config.demoMode) ...[
                  const SizedBox(height: 8),
                  Card(
                    color: RafeeqColors.gold500.withValues(alpha: 0.15),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(t.sandboxNote),
                        const SizedBox(height: 8),
                        TextField(controller: _card, keyboardType: TextInputType.number, textDirection: TextDirection.ltr, decoration: InputDecoration(labelText: t.testCard)),
                      ]),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton(onPressed: _busy || (left?.isNegative ?? false) ? null : _pay, child: Text(t.payAmount(Fmt.sar(target['totalHalalas'] as int, lang)))),
              ],
            ),
    );
  }
}

String methodLabel(dynamic t, String m) => switch (m) {
      'card' => t.methodCard as String,
      'apple_pay' => 'Apple Pay',
      'stc_pay' => 'STC Pay',
      _ => t.methodMada as String,
    };
