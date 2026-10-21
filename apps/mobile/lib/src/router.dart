import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/bookings/bag_screen.dart';
import 'screens/bookings/booking_screen.dart';
import 'screens/bookings/bookings_screen.dart';
import 'screens/guide/guide_screen.dart';
import 'screens/guide/map_screen.dart';
import 'screens/guide/qibla_screen.dart';
import 'screens/guide/route_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/home/services_screen.dart';
import 'screens/lost/finder_screen.dart';
import 'screens/lost/lost_screen.dart';
import 'screens/onboarding/language_screen.dart';
import 'screens/onboarding/login_screen.dart';
import 'screens/onboarding/setup_screen.dart';
import 'screens/profile/contacts_screen.dart';
import 'screens/profile/group_screen.dart';
import 'screens/profile/help_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/profile/tracker_tag_screen.dart';
import 'screens/services/book_screen.dart';
import 'screens/services/checkout_screen.dart';
import 'screens/services/service_screen.dart';
import 'screens/shell.dart';
import 'screens/shop/cart_screen.dart';
import 'screens/shop/order_screen.dart';
import 'screens/shop/product_screen.dart';
import 'screens/shop/shop_screen.dart';
import 'screens/staff/job_screen.dart';
import 'screens/staff/scanner_screen.dart';
import 'screens/staff/staff_home.dart';
import 'session.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Redirects follow the onboarding order from the guide: language first, then login,
/// then trip details. Staff accounts open staff mode.
final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ValueNotifier<SessionState>(ref.read(sessionProvider));
  ref.listen<SessionState>(sessionProvider, (_, next) => notifier.value = next);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/home',
    refreshListenable: notifier,
    redirect: (context, state) {
      final s = notifier.value;
      final loc = state.matchedLocation;
      if (s.loading) return loc == '/splash' ? null : '/splash';
      if (s.locale == null) return loc == '/language' ? null : '/language';
      // Login authentication commented out — skip /login; wait on splash until a demo session exists.
      // if (!s.loggedIn) return loc == '/login' ? null : '/login';
      if (!s.loggedIn) return loc == '/splash' ? null : '/splash';
      final me = s.me!;
      if (me.isStaff) return loc.startsWith('/staff') ? null : '/staff';
      if (!me.setupDone && loc != '/setup') return '/setup';
      if (loc == '/splash' || loc == '/language' || loc == '/login' || (loc == '/setup' && me.setupDone)) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, _) => const Scaffold(body: Center(child: CircularProgressIndicator())),
      ),
      GoRoute(path: '/language', builder: (_, _) => const LanguageScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/setup', builder: (_, _) => const SetupScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => PilgrimShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (_, _) => const HomeScreen(),
                routes: [
                  GoRoute(
                    path: 'services',
                    builder: (_, s) => ServicesScreen(category: s.uri.queryParameters['category'], query: s.uri.queryParameters['q']),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/bookings', builder: (_, _) => const BookingsScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/shop',
                builder: (_, s) => ShopScreen(section: s.uri.queryParameters['section'], shopId: s.uri.queryParameters['shop']),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/guide', builder: (_, _) => const GuideScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())],
          ),
        ],
      ),
      // Full-screen pages above the tabs
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/service/:id',
        builder: (_, s) => ServiceScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/service/:id/book',
        builder: (_, s) => BookScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/checkout',
        builder: (_, s) => CheckoutScreen(bookingId: s.uri.queryParameters['booking'], orderId: s.uri.queryParameters['order']),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/booking/:id',
        builder: (_, s) => BookingScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/bag/:id',
        builder: (_, s) => BagScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/product/:id',
        builder: (_, s) => ProductScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: '/cart', builder: (_, _) => const CartScreen()),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/order/:id',
        builder: (_, s) => OrderScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/map',
        builder: (_, s) => MapScreen(filter: s.uri.queryParameters['type']),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/route/:id',
        builder: (_, s) => RouteScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: '/qibla', builder: (_, _) => const QiblaScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/group', builder: (_, _) => const GroupScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/contacts', builder: (_, _) => const ContactsScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/tracker-tag', builder: (_, _) => const TrackerTagScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/help', builder: (_, _) => const HelpScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/lost', builder: (_, _) => const LostScreen()),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/finder/:userId',
        builder: (_, s) => FinderScreen(userId: s.pathParameters['userId']!),
      ),
      // Staff mode
      GoRoute(
        path: '/staff',
        builder: (_, _) => const StaffHome(),
        routes: [
          GoRoute(
            path: 'job/:id',
            builder: (_, s) => JobScreen(id: s.pathParameters['id']!),
          ),
          GoRoute(
            path: 'scan',
            builder: (_, s) => ScannerScreen(bookingId: s.uri.queryParameters['booking']),
          ),
        ],
      ),
    ],
  );
});
