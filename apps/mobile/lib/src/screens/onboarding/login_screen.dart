import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../session.dart';
import '../../widgets/common.dart';

/// Login screen (still reachable at /login). The router no longer requires it.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController(text: '+966');
  final _identifier = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  bool? _quick; // null while asking the API
  bool _sent = false;
  bool _busy = false;
  String? _demoCode;

  @override
  void initState() {
    super.initState();
    ref.read(sessionProvider.notifier).quickLoginEnabled().then((on) {
      if (mounted) setState(() => _quick = on);
    });
  }

  @override
  void dispose() {
    _phone.dispose();
    _identifier.dispose();
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() f) async {
    setState(() => _busy = true);
    try {
      await f();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _quickLogin() => _run(() => ref.read(sessionProvider.notifier).quickLogin(_identifier.text.trim(), name: _name.text.trim()));

  Future<void> _send() => _run(() async {
    final demo = await ref.read(sessionProvider.notifier).requestCode(_phone.text.replaceAll(' ', ''));
    setState(() {
      _sent = true;
      _demoCode = demo;
    });
  });

  Future<void> _verify() => _run(() => ref.read(sessionProvider.notifier).verify(_phone.text.replaceAll(' ', ''), _code.text.trim(), name: _name.text.trim()));

  @override
  Widget build(BuildContext context) {
    final t = l10n(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.login)),
      body: SafeArea(
        child: _quick == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(24), children: _quick! ? _quickForm(t) : _codeForm(t)),
      ),
    );
  }

  List<Widget> _quickForm(AppLocalizations t) => [
    Text(t.quickLoginIntro, style: Theme.of(context).textTheme.titleMedium),
    const SizedBox(height: 20),
    TextField(
      controller: _identifier,
      autofocus: true,
      keyboardType: TextInputType.emailAddress,
      textDirection: TextDirection.ltr,
      autofillHints: const [AutofillHints.username],
      decoration: InputDecoration(labelText: t.phoneOrEmail, hintText: '+966500000050 · ahmed@rafeeq.test'),
      onSubmitted: (_) => _quickLogin(),
    ),
    const SizedBox(height: 12),
    TextField(
      controller: _name,
      textCapitalization: TextCapitalization.words,
      decoration: InputDecoration(labelText: t.yourName, helperText: t.yourNameHint),
    ),
    const SizedBox(height: 20),
    FilledButton(onPressed: _busy ? null : _quickLogin, child: Text(t.login)),
  ];

  List<Widget> _codeForm(AppLocalizations t) => [
    Text(t.loginIntro, style: Theme.of(context).textTheme.titleMedium),
    const SizedBox(height: 20),
    TextField(
      controller: _phone,
      enabled: !_sent,
      keyboardType: TextInputType.phone,
      textDirection: TextDirection.ltr,
      autofillHints: const [AutofillHints.telephoneNumber],
      decoration: InputDecoration(labelText: t.phone, helperText: t.phoneHint),
    ),
    if (!_sent) ...[
      const SizedBox(height: 20),
      FilledButton(onPressed: _busy ? null : _send, child: Text(t.sendCode)),
    ] else ...[
      const SizedBox(height: 20),
      if (_demoCode != null)
        Card(
          child: Padding(padding: const EdgeInsets.all(12), child: Text(t.demoCode(_demoCode!))),
        ),
      TextField(
        controller: _code,
        keyboardType: TextInputType.number,
        maxLength: 6,
        textDirection: TextDirection.ltr,
        autofillHints: const [AutofillHints.oneTimeCode],
        decoration: InputDecoration(labelText: t.code),
      ),
      TextField(
        controller: _name,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(labelText: t.yourName, helperText: t.yourNameHint),
      ),
      const SizedBox(height: 20),
      FilledButton(onPressed: _busy ? null : _verify, child: Text(t.login)),
      TextButton(onPressed: _busy ? null : () => setState(() => _sent = false), child: Text(t.changeNumber)),
    ],
  ];
}
