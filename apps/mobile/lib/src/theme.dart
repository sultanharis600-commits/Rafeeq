import 'package:flutter/material.dart';

/// Rafeeq design tokens — same values as packages/shared/src/design.ts and the web CSS.
/// Colours follow the Saudi national design system (DGA Platforms Code): SA flag green,
/// gold and cool neutrals on white. The `sand` names are kept for the neutral greys.
abstract final class RafeeqColors {
  static const brand950 = Color(0xFF092A1E);
  static const brand900 = Color(0xFF104631);
  static const brand800 = Color(0xFF14573A);
  static const brand700 = Color(0xFF1B8354); // SA flag green, Platforms Code primary
  static const brand500 = Color(0xFF25935F);
  static const brand300 = Color(0xFF88D8AD);
  static const brand100 = Color(0xFFDFF6E7);
  static const brand50 = Color(0xFFF3FCF6);
  static const sand50 = Color(0xFFFFFFFF);
  static const sand100 = Color(0xFFF9FAFB);
  static const sand200 = Color(0xFFF3F4F6);
  static const sand300 = Color(0xFFD2D6DB);
  static const gold300 = Color(0xFFF7D54D);
  static const gold500 = Color(0xFFDBA102); // Platforms Code gold
  static const gold700 = Color(0xFF945C01); // gold for text on white
  static const clay500 = Color(0xFFB8562F);
  static const clay700 = Color(0xFF8A3D1F);
  static const clay100 = Color(0xFFF8E6DC);
  static const lavender500 = Color(0xFF80519F); // Platforms Code tertiary
  static const ink900 = Color(0xFF1F2A37);
  static const ink600 = Color(0xFF4D5761);
  static const danger = Color(0xFFD92D20);

  /// Hero surfaces: flag green into night green.
  static const heroGradient = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [brand700, brand800, brand950],
    stops: [0, 0.6, 1],
  );
  static const goldGradient = LinearGradient(colors: [gold300, gold500]);

  /// Product picture backgrounds (pictures, not containers). White text passes on each.
  static const tileGreen = [brand500, brand900];
  static const tileAmber = [Color(0xFFB87B02), Color(0xFF6E3C00)];
  static const tileBrown = [Color(0xFF8A6524), Color(0xFF523B10)];

  /// Icon colour per service category and a soft accent drawn behind it.
  static const tints = <String, (Color, Color)>{
    'transport': (brand100, brand700),
    'guides': (Color(0xFFFCF3BD), gold700),
    'photography': (clay100, clay700),
    'luggage': (Color(0xFFE0ECF7), Color(0xFF1F5F8B)),
    'accessibility': (Color(0xFFEFE6F5), lavender500),
    'heritage_tours': (Color(0xFFF2E8D4), Color(0xFF7A5A1E)),
  };
}


/// Body text at least 16, buttons at least 48 tall (AI_RULES.md).
/// Accessibility mode: larger text and buttons, plain white background, stronger contrast.
/// The phone's own text-size setting is respected on top of this.
ThemeData rafeeqTheme({bool accessibilityMode = false, String? language}) {
  final scale = accessibilityMode ? 1.3 : 1.0;
  final arabicScript = language == 'ar' || language == 'ur';
  final background = Colors.white; // Platforms Code: content sits on white, no card boxes
  final base = ThemeData(
    useMaterial3: true,
    fontFamilyFallback: arabicScript ? const ['IBM Plex Sans Arabic', 'Noto Naskh Arabic'] : const ['Inter'],
    colorScheme: ColorScheme.fromSeed(
      seedColor: RafeeqColors.brand700,
      primary: accessibilityMode ? RafeeqColors.brand900 : RafeeqColors.brand700,
      onPrimary: Colors.white,
      primaryContainer: RafeeqColors.brand100,
      onPrimaryContainer: RafeeqColors.brand900,
      secondary: RafeeqColors.gold500,
      onSecondary: RafeeqColors.brand950,
      secondaryContainer: const Color(0xFFFBF1D9),
      onSecondaryContainer: RafeeqColors.ink900,
      tertiary: RafeeqColors.clay500,
      surface: background,
      onSurface: RafeeqColors.ink900,
      onSurfaceVariant: RafeeqColors.ink600,
      outline: RafeeqColors.sand300,
      outlineVariant: RafeeqColors.sand200,
      error: RafeeqColors.danger,
    ),
    scaffoldBackgroundColor: background,
  );
  final minButton = Size(48, accessibilityMode ? 64 : 54);
  final radius = BorderRadius.circular(16);
  return base.copyWith(
    textTheme: base.textTheme
        .apply(fontSizeFactor: scale, bodyColor: RafeeqColors.ink900, displayColor: RafeeqColors.ink900)
        .copyWith(
          bodyLarge: base.textTheme.bodyLarge?.copyWith(fontSize: 18 * scale, color: RafeeqColors.ink900),
          bodyMedium: base.textTheme.bodyMedium?.copyWith(fontSize: 16 * scale, color: RafeeqColors.ink900),
          bodySmall: base.textTheme.bodySmall?.copyWith(fontSize: 14 * scale, color: RafeeqColors.ink600),
          titleLarge: base.textTheme.titleLarge?.copyWith(fontSize: 22 * scale, fontWeight: FontWeight.w700, color: RafeeqColors.brand900),
        ),
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      surfaceTintColor: Colors.transparent,
      foregroundColor: RafeeqColors.brand900,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: RafeeqColors.sand300,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 22 * scale, fontWeight: FontWeight.w800, color: RafeeqColors.brand900),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: minButton,
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: TextStyle(fontSize: 18 * scale, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: minButton,
        shape: RoundedRectangleBorder(borderRadius: radius),
        side: const BorderSide(color: RafeeqColors.sand300, width: 1.5),
        foregroundColor: RafeeqColors.brand700,
        textStyle: TextStyle(fontSize: 17 * scale, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: minButton,
        foregroundColor: RafeeqColors.brand700,
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
    ),
    // No boxed cards: a Card is a plain row separated by a hairline.
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: Border(bottom: BorderSide(color: RafeeqColors.sand200)),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      prefixIconColor: RafeeqColors.brand700,
      border: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: RafeeqColors.sand300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: RafeeqColors.sand300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: RafeeqColors.brand700, width: 2),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: RafeeqColors.brand100,
      side: const BorderSide(color: RafeeqColors.sand300),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      labelStyle: TextStyle(fontSize: 15 * scale, color: RafeeqColors.ink900),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: RafeeqColors.brand700,
      unselectedLabelColor: RafeeqColors.ink600,
      indicatorColor: RafeeqColors.gold500,
      indicatorSize: TabBarIndicatorSize.label,
      dividerColor: RafeeqColors.sand200,
      labelStyle: TextStyle(fontSize: 16 * scale, fontWeight: FontWeight.w700),
      unselectedLabelStyle: TextStyle(fontSize: 16 * scale, fontWeight: FontWeight.w500),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: accessibilityMode ? 84 : 70,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(size: 26 * scale, color: s.contains(WidgetState.selected) ? RafeeqColors.brand700 : RafeeqColors.ink600),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontSize: 13 * scale,
          fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
          color: s.contains(WidgetState.selected) ? RafeeqColors.brand700 : RafeeqColors.ink600,
        ),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : null),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? RafeeqColors.brand700 : null),
    ),
    listTileTheme: ListTileThemeData(minVerticalPadding: accessibilityMode ? 14 : 10, iconColor: RafeeqColors.brand700),
    dividerTheme: const DividerThemeData(color: RafeeqColors.sand200, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: RafeeqColors.brand900,
      shape: RoundedRectangleBorder(borderRadius: radius),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: RafeeqColors.sand50,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: RafeeqColors.sand50,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
  );
}
