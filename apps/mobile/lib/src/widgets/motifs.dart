import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Saudi decorative motifs shared by the screens: the eight-point star (khatim) lattice,
/// the Sadu weave band, the Rafeeq mark and the green hero header.

/// Faint lattice of eight-point stars, drawn over dark green surfaces.
class KhatimPattern extends CustomPainter {
  const KhatimPattern({this.color = RafeeqColors.gold300, this.opacity = 0.14, this.cell = 44});
  final Color color;
  final double opacity;
  final double cell;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = color.withValues(alpha: opacity);
    final r = cell * 0.2;
    for (var y = cell / 2; y < size.height + cell; y += cell) {
      for (var x = cell / 2; x < size.width + cell; x += cell) {
        _star(canvas, Offset(x, y), r, paint);
      }
    }
  }

  static void _star(Canvas canvas, Offset c, double r, Paint paint) {
    canvas.drawRect(Rect.fromCenter(center: c, width: r * 2, height: r * 2), paint);
    final d = r * math.sqrt2;
    canvas.drawPath(
      Path()
        ..moveTo(c.dx, c.dy - d)
        ..lineTo(c.dx + d, c.dy)
        ..lineTo(c.dx, c.dy + d)
        ..lineTo(c.dx - d, c.dy)
        ..close(),
      paint,
    );
  }

  @override
  bool shouldRepaint(KhatimPattern old) => old.color != color || old.opacity != opacity || old.cell != cell;
}

/// The woven Bedouin Sadu stripe: gold and terracotta triangles on night green.
class SaduBand extends StatelessWidget {
  const SaduBand({super.key, this.height = 10});
  final double height;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _SaduPainter()),
    ),
  );
}

class _SaduPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    final w = h * 2;
    canvas.drawRect(Offset.zero & size, Paint()..color = RafeeqColors.brand900);
    final gold = Paint()..color = RafeeqColors.gold500;
    final clay = Paint()..color = RafeeqColors.clay500;
    final sand = Paint()..color = RafeeqColors.sand100;
    for (var x = 0.0; x < size.width; x += w) {
      canvas.drawPath(
        Path()
          ..moveTo(x, h)
          ..lineTo(x + w / 4, h * 0.1)
          ..lineTo(x + w / 2, h)
          ..close(),
        gold,
      );
      canvas.drawPath(
        Path()
          ..moveTo(x + w / 2, 0)
          ..lineTo(x + w * 3 / 4, h * 0.9)
          ..lineTo(x + w, 0)
          ..close(),
        clay,
      );
      final cx = x + w / 4, cy = h * 0.72, s = h * 0.2;
      canvas.drawPath(
        Path()
          ..moveTo(cx, cy - s)
          ..lineTo(cx + s * 0.7, cy)
          ..lineTo(cx, cy + s)
          ..lineTo(cx - s * 0.7, cy)
          ..close(),
        sand,
      );
    }
  }

  @override
  bool shouldRepaint(_SaduPainter old) => false;
}

/// Rafeeq mark: a gold eight-point star with a night-green arch window.
class RafeeqLogo extends StatelessWidget {
  const RafeeqLogo({super.key, this.size = 64, this.semanticLabel});
  final double size;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) => Semantics(
    label: semanticLabel,
    image: semanticLabel != null,
    child: SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _LogoPainter()),
    ),
  );
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 48;
    canvas.scale(s);
    const c = Offset(24, 24);
    final gold = Paint()..color = RafeeqColors.gold500;
    final square = RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: 28, height: 28), const Radius.circular(3));
    canvas.drawShadow(Path()..addRRect(square), Colors.black, 3, false);
    canvas.drawRRect(square, gold);
    canvas.save();
    canvas.translate(24, 24);
    canvas.rotate(math.pi / 4);
    canvas.translate(-24, -24);
    canvas.drawRRect(square, gold);
    canvas.restore();
    canvas.drawCircle(c, 10.5, Paint()..color = RafeeqColors.brand900);
    canvas.drawPath(
      Path()
        ..moveTo(19, 31)
        ..lineTo(19, 24.5)
        ..arcToPoint(const Offset(29, 24.5), radius: const Radius.circular(5))
        ..lineTo(29, 31)
        ..close(),
      Paint()..color = RafeeqColors.gold300,
    );
    canvas.drawCircle(const Offset(24, 19.5), 1.4, Paint()..color = RafeeqColors.brand900);
  }

  @override
  bool shouldRepaint(_LogoPainter old) => false;
}

/// Green gradient header with the star lattice, rounded at the bottom and edged with Sadu.
class HeroHeader extends StatelessWidget {
  const HeroHeader({super.key, required this.child, this.padding = const EdgeInsets.fromLTRB(20, 12, 20, 24), this.sadu = true, this.rounded = true});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool sadu;

  /// Round the bottom corners; Home runs the header square, edge to edge.
  final bool rounded;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: rounded ? const BorderRadius.vertical(bottom: Radius.circular(28)) : BorderRadius.zero,
      child: DecoratedBox(
        decoration: const BoxDecoration(gradient: RafeeqColors.heroGradient),
        child: Stack(
          children: [
            const Positioned.fill(
              child: ExcludeSemantics(child: CustomPaint(painter: KhatimPattern())),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SafeArea(
                  bottom: false,
                  child: Padding(padding: padding, child: child),
                ),
                if (sadu) const SaduBand(height: 8),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Small rounded-square icon chip with a soft tint.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.background = RafeeqColors.brand100, this.color = RafeeqColors.brand700, this.size = 44});
  final IconData icon;
  final Color background;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(size * 0.32)),
    child: Icon(icon, color: color, size: size * 0.56),
  );
}

/// Translucent square icon button for use on the green hero surfaces.
class HeroIconButton extends StatelessWidget {
  const HeroIconButton({super.key, required this.icon, required this.tooltip, required this.onPressed, this.badge, this.circle = false});
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final int? badge;

  /// A round outline button (Home header) instead of the rounded square.
  final bool circle;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onPressed,
    style: IconButton.styleFrom(
      backgroundColor: circle ? Colors.transparent : Colors.white.withValues(alpha: 0.14),
      foregroundColor: Colors.white,
      minimumSize: const Size(52, 52),
      shape: circle
          ? CircleBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.3)))
          : RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.22)),
            ),
    ),
    icon: Badge(
      isLabelVisible: (badge ?? 0) > 0,
      label: Text('${badge ?? 0}'),
      backgroundColor: RafeeqColors.gold500,
      textColor: RafeeqColors.brand950,
      child: Icon(icon, size: 26),
    ),
  );
}

/// Green patterned app bar for the main tabs, edged with a Sadu band.
/// [bottom] (e.g. a TabBar) sits on the green, above the band.
AppBar heroAppBar({required String title, List<Widget>? actions, PreferredSizeWidget? bottom}) {
  final bottomHeight = (bottom?.preferredSize.height ?? 0) + 8;
  return AppBar(
    title: Text(title),
    foregroundColor: Colors.white,
    backgroundColor: RafeeqColors.brand900,
    titleTextStyle: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
    toolbarHeight: 64,
    actions: [...?actions, const SizedBox(width: 8)],
    flexibleSpace: const DecoratedBox(
      decoration: BoxDecoration(gradient: RafeeqColors.heroGradient),
      child: ExcludeSemantics(
        child: CustomPaint(painter: KhatimPattern(), size: Size.infinite),
      ),
    ),
    bottom: PreferredSize(
      preferredSize: Size.fromHeight(bottomHeight),
      child: Column(children: [if (bottom != null) bottom, const SaduBand(height: 8)]),
    ),
  );
}

/// TabBar styled for [heroAppBar]: white labels and a gold indicator.
TabBar heroTabBar({required List<Widget> tabs, bool isScrollable = false}) => TabBar(
  tabs: tabs,
  isScrollable: isScrollable,
  tabAlignment: isScrollable ? TabAlignment.start : null,
  labelColor: Colors.white,
  unselectedLabelColor: Colors.white70,
  indicatorColor: RafeeqColors.gold500,
  indicatorWeight: 3,
  dividerColor: Colors.transparent,
);
