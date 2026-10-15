import 'package:flutter/material.dart';

/// Rafeeq design tokens — same values as packages/shared/src/design.ts and the web CSS.
abstract final class RafeeqColors {
  static const brand900 = Color(0xFF063D3A);
  static const brand700 = Color(0xFF0B5D57);
  static const brand500 = Color(0xFF128C7E);
  static const brand100 = Color(0xFFD7EFEB);
  static const sand100 = Color(0xFFF7F1E6);
  static const sand300 = Color(0xFFE8DCC4);
  static const gold500 = Color(0xFFC9A227);
  static const ink900 = Color(0xFF1C2421);
  static const ink600 = Color(0xFF4B5754);
  static const danger = Color(0xFFB3261E);
}

/// Body text at least 16, buttons at least 48 tall (AI_RULES.md).
/// Accessibility mode: larger text and buttons, plain white background, stronger contrast.
/// The phone's own text-size setting is respected on top of this.
ThemeData rafeeqTheme({bool accessibilityMode = false, String? language}) {
  final scale = accessibilityMode ? 1.3 : 1.0;
  final arabicScript = language == 'ar' || language == 'ur';
  final base = ThemeData(
    useMaterial3: true,
    fontFamilyFallback: arabicScript ? const ['IBM Plex Sans Arabic', 'Noto Naskh Arabic'] : const ['Inter'],
    colorScheme: ColorScheme.fromSeed(
      seedColor: RafeeqColors.brand700,
      primary: accessibilityMode ? RafeeqColors.brand900 : RafeeqColors.brand700,
      secondary: RafeeqColors.gold500,
      surface: accessibilityMode ? Colors.white : RafeeqColors.sand100,
      onSurface: RafeeqColors.ink900,
      error: RafeeqColors.danger,
    ),
    scaffoldBackgroundColor: accessibilityMode ? Colors.white : RafeeqColors.sand100,
  );
  final minButton = Size(48, accessibilityMode ? 64 : 52);
  return base.copyWith(
    textTheme: base.textTheme
        .apply(fontSizeFactor: scale, bodyColor: RafeeqColors.ink900, displayColor: RafeeqColors.ink900)
        .copyWith(
          bodyLarge: base.textTheme.bodyLarge?.copyWith(fontSize: 18 * scale, color: RafeeqColors.ink900),
          bodyMedium: base.textTheme.bodyMedium?.copyWith(fontSize: 16 * scale, color: RafeeqColors.ink900),
          bodySmall: base.textTheme.bodySmall?.copyWith(fontSize: 14 * scale, color: RafeeqColors.ink600),
        ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: minButton, textStyle: TextStyle(fontSize: 18 * scale, fontWeight: FontWeight.w600)),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: minButton, textStyle: TextStyle(fontSize: 17 * scale)),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(minimumSize: minButton)),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: RafeeqColors.sand300)),
      margin: const EdgeInsets.symmetric(vertical: 6),
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder(), filled: true, fillColor: Colors.white),
    navigationBarTheme: NavigationBarThemeData(
      height: accessibilityMode ? 84 : 72,
      labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 13 * scale, fontWeight: FontWeight.w600)),
    ),
    listTileTheme: ListTileThemeData(minVerticalPadding: accessibilityMode ? 14 : 8),
  );
}
