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
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          ref.invalidate(bannersProvider);
          ref.invalidate(myBookingsProvider('upcoming'));
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            HeroHeader(
              rounded: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const RafeeqLogo(size: 44),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              t.helloName(me.name.split(' ').first),
                              style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
                            ),
                            if (me.city != null)
                              Row(
                                children: [
                                  const Icon(Icons.location_on_rounded, size: 16, color: RafeeqColors.gold300),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      [me.city == 'madinah' ? t.madinah : t.makkah, if (me.hotel != null) pick(me.hotel!['name'], lang)].join(' · '),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: RafeeqColors.gold300, fontSize: 15),
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                      HeroIconButton(icon: Icons.shopping_bag_rounded, tooltip: t.cart, circle: true, onPressed: () => context.push('/cart')),
                    ],
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: t.searchHint,
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(28), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(28),
                        borderSide: const BorderSide(color: RafeeqColors.gold500, width: 2),
                      ),
                    ),
                    onSubmitted: (q) => context.go('/home/services?q=${Uri.encodeQueryComponent(q)}'),
                  ),
                ],
              ),
            ),
            _LostButton(large: a11y),
            upcoming.maybeWhen(
              data: (c) {
                if (c.data.isEmpty) return const SizedBox.shrink();
                final b = c.data.first;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      border: Border.symmetric(horizontal: BorderSide(color: RafeeqColors.sand200)),
                    ),
                    child: TicketCard(
                      icon: categoryIcon(b['category'] as String),
                      caption: t.nextBooking,
                      title: b['title'] as String,
                      when: Fmt.dateTime(b['startsAt'] as String?, lang),
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
                padding: const EdgeInsets.symmetric(horizontal: 8),
                mainAxisSpacing: 4,
                crossAxisSpacing: 4,
                childAspectRatio: a11y ? 1.1 : 0.95,
                children: [
                  for (final c in cats)
                    if (!a11y || const {'transport', 'accessibility', 'luggage', 'guides'}.contains(c['category']))
                      BigTile(
                        icon: categoryIcon(c['category'] as String),
                        label: categoryLabel(t, c['category'] as String),
                        tint: RafeeqColors.tints[c['category']]?.$1,
                        color: RafeeqColors.tints[c['category']]?.$2,
                        onTap: () => context.go('/home/services?category=${c['category']}'),
                      ),
                ],
              ),
            ),
            if (!a11y) ...[
              SectionTitle(t.offers),
              banners.maybeWhen(
                data: (list) => list.isEmpty ? const SizedBox.shrink() : _OfferBand(items: list),
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
/// "I'm lost" is always one tap away on Home (guide: Lost Companion): a solid red pill,
/// the one strong colour on the page.
class _LostButton extends StatelessWidget {
  const _LostButton({required this.large});
  final bool large;

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: RafeeqColors.danger,
          foregroundColor: Colors.white,
          minimumSize: Size.fromHeight(large ? 84 : 60),
          shape: const StadiumBorder(),
        ),
        onPressed: () => context.push('/lost'),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.sos_rounded, size: large ? 40 : 30),
            const SizedBox(width: 12),
            Text(
              t.imLost,
              style: TextStyle(fontSize: large ? 26 : 20, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

/// Offers as an edge-to-edge band that swipes, with page dots under it. No boxes: each
/// offer fills the full width on green with the star lattice.
class _OfferBand extends StatefulWidget {
  const _OfferBand({required this.items});
  final List<Json> items;

  @override
  State<_OfferBand> createState() => _OfferBandState();
}

class _OfferBandState extends State<_OfferBand> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 168,
          child: PageView.builder(
            itemCount: widget.items.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (_, i) => _Offer(item: widget.items[i]),
          ),
        ),
        const SaduBand(height: 6),
        const SizedBox(height: 10),
        ExcludeSemantics(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < widget.items.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 22 : 7,
                  height: 7,
                  decoration: BoxDecoration(color: i == _page ? RafeeqColors.brand700 : RafeeqColors.sand300, borderRadius: BorderRadius.circular(4)),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Offer extends StatelessWidget {
  const _Offer({required this.item});
  final Json item;

  @override
  Widget build(BuildContext context) {
    final link = item['link'] as String?;
    return Material(
      child: Ink(
        decoration: const BoxDecoration(gradient: RafeeqColors.heroGradient),
        child: InkWell(
          onTap: link == null ? null : () => openDeepLink(context, link),
          child: Stack(
            children: [
              const Positioned.fill(
                child: ExcludeSemantics(child: CustomPaint(painter: KhatimPattern(cell: 36))),
              ),
              PositionedDirectional(
                end: -40,
                top: -30,
                child: ExcludeSemantics(
                  child: SizedBox.square(dimension: 190, child: CustomPaint(painter: StarOrnament(RafeeqColors.gold300.withValues(alpha: 0.3)))),
                ),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 20, 120, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.local_offer_rounded, color: RafeeqColors.gold300, size: 22),
                    const SizedBox(height: 8),
                    Text(
                      item['title'] as String,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800, height: 1.25),
                    ),
                    if ((item['body'] as String?)?.isNotEmpty ?? false)
                      Text(
                        item['body'] as String,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: RafeeqColors.brand100),
                      ),
                  ],
                ),
              ),
              PositionedDirectional(
                end: 20,
                bottom: 20,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(color: RafeeqColors.gold500, shape: BoxShape.circle),
                  child: const Icon(Icons.arrow_forward_rounded, color: RafeeqColors.brand950),
                ),
              ),
            ],
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
