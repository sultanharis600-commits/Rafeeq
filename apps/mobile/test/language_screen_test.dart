import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rafeeq/src/api/client.dart';
import 'package:rafeeq/src/app.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> pumpApp(WidgetTester tester) async {
  SharedPreferences.setMockInitialValues({});
  FlutterSecureStorage.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  await tester.pumpWidget(ProviderScope(overrides: [prefsProvider.overrideWithValue(prefs)], child: const RafeeqApp()));
  await tester.pumpAndSettle();
}

/// Home and login both kick off API calls, so pumpAndSettle can hang; pump the route change instead.
Future<void> settleRoute(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  testWidgets('first launch asks for the language, each written in its own script', (tester) async {
    await pumpApp(tester);
    for (final name in ['العربية', 'English', 'اردو', 'Bahasa Indonesia', 'Bahasa Melayu', 'Türkçe']) {
      expect(find.text(name), findsOneWidget);
    }
  });

  testWidgets('choosing Arabic goes to home, right-to-left and in Arabic', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('العربية'));
    await settleRoute(tester);

    expect(find.text('ابحث عن نقل، مرشدين، أمتعة…'), findsWidgets);
    final context = tester.element(find.byType(Scaffold).first);
    expect(Directionality.of(context), TextDirection.rtl);
  });

  testWidgets('choosing Indonesian shows the home screen in Indonesian', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('Bahasa Indonesia'));
    await settleRoute(tester);

    expect(find.text('Cari transportasi, pembimbing, bagasi…'), findsWidgets);
    final context = tester.element(find.byType(Scaffold).first);
    expect(Directionality.of(context), TextDirection.ltr);
  });
}
