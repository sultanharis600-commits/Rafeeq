import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/motifs.dart';

/// First screen on first launch: choose the language before anything else.
/// Each option is written in its own language, so no one needs to read English.
class LanguageScreen extends ConsumerWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final current = ref.watch(sessionProvider).locale?.languageCode;
    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeroHeader(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
            child: Column(
              children: [
                RafeeqLogo(size: 88, semanticLabel: t.appName),
                const SizedBox(height: 14),
                Text(
                  t.appName,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  t.welcome,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: RafeeqColors.gold300, fontSize: 18),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.translate_rounded, color: RafeeqColors.brand700),
                    const SizedBox(width: 10),
                    Text(t.chooseLanguage, style: Theme.of(context).textTheme.titleLarge),
                  ],
                ),
                const SizedBox(height: 14),
                for (final code in supportedLanguageCodes)
                  Padding(
                    padding: EdgeInsets.zero,
                    child: _LanguageOption(code: code, selected: code == current, onTap: () => ref.read(sessionProvider.notifier).chooseLanguage(code)),
                  ),
              ],
            ),
          ),
        ],
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
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: RafeeqColors.sand200)),
        ),
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            // A flat row with a hairline under it (no box); the selected row gets a soft green wash.
            minimumSize: const Size.fromHeight(64),
            backgroundColor: selected ? RafeeqColors.brand50 : Colors.transparent,
            side: BorderSide.none,
            shape: const RoundedRectangleBorder(),
            foregroundColor: RafeeqColors.ink900,
            padding: const EdgeInsets.symmetric(horizontal: 16),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(fontSize: 22, fontWeight: selected ? FontWeight.w800 : FontWeight.w600),
                  textDirection: rtlLanguages.contains(code) ? TextDirection.rtl : TextDirection.ltr,
                ),
              ),
              Icon(selected ? Icons.check_circle_rounded : Icons.circle_outlined, color: selected ? RafeeqColors.brand700 : RafeeqColors.sand300, size: 28),
            ],
          ),
        ),
      ),
    );
  }
}
