import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/client.dart';
import '../../data.dart';
import '../../widgets/common.dart';

/// Emergency contacts: they get an SMS with a map link when the pilgrim presses "I'm lost".
class ContactsScreen extends ConsumerWidget {
  const ContactsScreen({super.key});

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final t = l10n(context);
    final name = TextEditingController();
    final phone = TextEditingController(text: '+');
    final relation = TextEditingController();
    final formKey = GlobalKey<FormState>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(t.addContact),
        content: Form(
          key: formKey,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(controller: name, decoration: InputDecoration(labelText: t.name), validator: (v) => (v ?? '').trim().isEmpty ? t.required : null),
            const SizedBox(height: 8),
            TextFormField(
              controller: phone,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(labelText: t.phoneWithCountry, hintText: '+62…'),
              validator: (v) => RegExp(r'^\+[1-9]\d{7,14}$').hasMatch((v ?? '').replaceAll(' ', '')) ? null : t.errPhone,
            ),
            const SizedBox(height: 8),
            TextFormField(controller: relation, decoration: InputDecoration(labelText: t.relation)),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(t.cancel)),
          FilledButton(onPressed: () => formKey.currentState!.validate() ? Navigator.pop(c, true) : null, child: Text(t.save)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).post('/me/emergency-contacts', {
        'name': name.text.trim(),
        'phone': phone.text.replaceAll(' ', ''),
        if (relation.text.trim().isNotEmpty) 'relation': relation.text.trim(),
      });
      ref.invalidate(contactsProvider);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = l10n(context);
    final contacts = ref.watch(contactsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t.emergencyContacts)),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _add(context, ref), icon: const Icon(Icons.add), label: Text(t.addContact)),
      body: AsyncView(
        value: contacts,
        onRetry: () => ref.invalidate(contactsProvider),
        builder: (list) => ListView(padding: const EdgeInsets.only(bottom: 96), children: [
          Padding(padding: const EdgeInsets.all(16), child: Text(t.emergencyContactsHint)),
          if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(t.noContacts)),
          for (final c in list)
            ListTile(
              leading: const Icon(Icons.person, size: 32),
              title: Text(c['name'] as String),
              subtitle: Text([c['phone'] as String, if (c['relation'] != null) c['relation'] as String].join(' · '), textDirection: TextDirection.ltr),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(tooltip: t.call, icon: const Icon(Icons.call), onPressed: () => launchUrl(Uri.parse('tel:${c['phone']}'))),
                IconButton(
                  tooltip: t.delete,
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    try {
                      await ref.read(apiProvider).delete('/me/emergency-contacts/${c['id']}');
                      ref.invalidate(contactsProvider);
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
                ),
              ]),
            ),
        ]),
      ),
    );
  }
}
