import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../session.dart';
import '../../theme.dart';

/// First screen on first launch: choose the language before anything else.
/// Each option is written in its own language, so no one needs to read English.
class LanguageScreen extends ConsumerWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final current = ref.watch(sessionProvider).locale?.languageCode;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 24),
            Icon(Icons.mosque, size: 56, color: RafeeqColors.brand700, semanticLabel: t.appName),
            const SizedBox(height: 8),
            Text(t.appName, textAlign: TextAlign.center, style: Theme.of(context).textTheme.displaySmall?.copyWith(color: RafeeqColors.brand900)),
            Text(t.welcome, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 32),
            Text(t.chooseLanguage, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final code in supportedLanguageCodes)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _LanguageOption(code: code, selected: code == current, onTap: () => ref.read(sessionProvider.notifier).chooseLanguage(code)),
              ),
          ],
        ),
      ),
    );
  }
}

class _LanguageOption extends StatelessWidget {
  const _LanguageOption({required this.code, required this.selected, required this.onTap});
  final String code;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // The language's own name, from that language's strings.
    final name = lookupAppLocalizations(Locale(code)).languageName;
    return Semantics(
      selected: selected,
      button: true,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(60),
          backgroundColor: selected ? RafeeqColors.brand100 : Colors.white,
          alignment: AlignmentDirectional.centerStart,
        ),
        child: Text(name, style: const TextStyle(fontSize: 22), textDirection: rtlLanguages.contains(code) ? TextDirection.rtl : TextDirection.ltr),
      ),
    );
  }
}
