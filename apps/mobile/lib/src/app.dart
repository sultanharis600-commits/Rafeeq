import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'config.dart';
import 'router.dart';
import 'session.dart';
import 'theme.dart';

class RafeeqApp extends ConsumerWidget {
  const RafeeqApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final router = ref.watch(routerProvider);
    final lang = session.locale?.languageCode;
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      theme: rafeeqTheme(accessibilityMode: session.accessibilityMode, language: lang),
      locale: session.locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
      builder: (context, child) => Config.demoMode
          ? Banner(message: AppLocalizations.of(context).demoShort, location: BannerLocation.topEnd, child: child!)
          : child!,
    );
  }
}
