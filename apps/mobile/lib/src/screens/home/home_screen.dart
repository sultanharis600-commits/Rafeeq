import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../util/format.dart';
import '../../widgets/common.dart';

/// Home: search, category icons, offers, "I'm lost". Accessibility mode shows fewer,
/// larger items.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    final session = ref.watch(sessionProvider);
    final me = session.me!;
    final a11y = session.accessibilityMode;
    final categories = ref.watch(categoriesProvider);
    final banners = ref.watch(bannersProvider);
    final upcoming = ref.watch(myBookingsProvider('upcoming'));
    final lang = session.locale?.languageCode ?? 'en';

    return Scaffold(
      appBar: AppBar(title: Text(t.helloName(me.name.split(' ').first)), actions: [
        IconButton(tooltip: t.cart, icon: const Icon(Icons.shopping_bag_outlined), onPressed: () => context.push('/cart')),
      ]),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          ref.invalidate(bannersProvider);
          ref.invalidate(myBookingsProvider('upcoming'));
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            _LostButton(large: a11y),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: t.searchHint),
                onSubmitted: (q) => context.go('/home/services?q=${Uri.encodeQueryComponent(q)}'),
              ),
            ),
            upcoming.maybeWhen(
              data: (c) {
                if (c.data.isEmpty) return const SizedBox.shrink();
                final b = c.data.first;
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Card(
                    child: ListTile(
                      leading: Icon(categoryIcon(b['category'] as String), color: RafeeqColors.brand700),
                      title: Text(b['title'] as String),
                      subtitle: Text('${t.nextBooking} · ${Fmt.dateTime(b['startsAt'] as String?, lang)}'),
                      trailing: StatusChip(b['status'] as String),
                      onTap: () => context.push('/booking/${b['id']}'),
                    ),
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
            SectionTitle(t.services),
            AsyncView(
              value: categories,
              onRetry: () => ref.invalidate(categoriesProvider),
              builder: (cats) => GridView.count(
                crossAxisCount: a11y ? 2 : 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: a11y ? 1.1 : 0.95,
                children: [
                  for (final c in cats)
                    if (!a11y || const {'transport', 'accessibility', 'luggage', 'guides'}.contains(c['category']))
                      BigTile(
                        icon: categoryIcon(c['category'] as String),
                        label: categoryLabel(t, c['category'] as String),
                        onTap: () => context.go('/home/services?category=${c['category']}'),
                      ),
                ],
              ),
            ),
            if (!a11y) ...[
              SectionTitle(t.offers),
              banners.maybeWhen(
                data: (list) => SizedBox(
                  height: 120,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => _Banner(item: list[i]),
                  ),
                ),
                orElse: () => const SizedBox.shrink(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// "I'm lost" is always one tap away on Home (guide: Lost Companion).
class _LostButton extends StatelessWidget {
  const _LostButton({required this.large});
  final bool large;

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: RafeeqColors.danger, minimumSize: Size.fromHeight(large ? 88 : 64)),
        icon: Icon(Icons.sos, size: large ? 40 : 28),
        label: Text(t.imLost, style: TextStyle(fontSize: large ? 26 : 20, fontWeight: FontWeight.w700)),
        onPressed: () => context.push('/lost'),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.item});
  final Json item;

  @override
  Widget build(BuildContext context) {
    final link = item['link'] as String?;
    return SizedBox(
      width: 280,
      child: Card(
        color: RafeeqColors.brand900,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: link == null ? null : () => openDeepLink(context, link),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item['title'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
              if ((item['body'] as String?)?.isNotEmpty ?? false)
                Text(item['body'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: RafeeqColors.brand100)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// rafeeq://services?category=luggage → in-app route. Used by banners, push and SMS links.
void openDeepLink(BuildContext context, String link) {
  final uri = Uri.tryParse(link);
  if (uri == null || uri.scheme != 'rafeeq') return;
  switch (uri.host) {
    case 'services':
      context.go('/home/services?${uri.query}');
    case 'shop':
      context.go('/shop?${uri.query}');
    case 'booking':
      context.push('/booking/${uri.pathSegments.first}');
    case 'order':
      context.push('/order/${uri.pathSegments.first}');
    default:
      break;
  }
}
