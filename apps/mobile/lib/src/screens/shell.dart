import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/offline_queue.dart';
import '../lost/location_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Five bottom tabs: Home, Bookings, Shop, Guide, Profile. Large icons with labels.
class PilgrimShell extends ConsumerStatefulWidget {
  const PilgrimShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  ConsumerState<PilgrimShell> createState() => _PilgrimShellState();
}

class _PilgrimShellState extends ConsumerState<PilgrimShell> {
  @override
  void initState() {
    super.initState();
    // Start recording the last known location if the pilgrim agreed to share it.
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(locationServiceProvider).start());
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final waiting = ref.watch(offlineQueueProvider).length;
    return Scaffold(
      body: Column(
        children: [
          if (waiting > 0)
            Material(
              color: Theme.of(context).colorScheme.secondaryContainer,
              child: SafeArea(
                bottom: false,
                child: ListTile(dense: true, leading: const Icon(Icons.cloud_upload_rounded), title: Text(t.waitingToSend(waiting))),
              ),
            ),
          Expanded(child: widget.shell),
        ],
      ),
      // Flat bar, edge to edge, with a hairline on top (no floating box).
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: RafeeqColors.sand300)),
        ),
        child: NavigationBar(
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          selectedIndex: widget.shell.currentIndex,
          onDestinationSelected: (i) => widget.shell.goBranch(i, initialLocation: i == widget.shell.currentIndex),
          destinations: [
            NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home_rounded), label: t.tabHome),
            NavigationDestination(
              icon: const Icon(Icons.calendar_month_outlined),
              selectedIcon: const Icon(Icons.calendar_month_rounded),
              label: t.tabBookings,
            ),
            NavigationDestination(icon: const Icon(Icons.redeem_outlined), selectedIcon: const Icon(Icons.redeem_rounded), label: t.tabShop),
            NavigationDestination(icon: const Icon(Icons.explore_outlined), selectedIcon: const Icon(Icons.explore_rounded), label: t.tabGuide),
            NavigationDestination(icon: const Icon(Icons.person_outline_rounded), selectedIcon: const Icon(Icons.person_rounded), label: t.tabProfile),
          ],
        ),
      ),
    );
  }
}
