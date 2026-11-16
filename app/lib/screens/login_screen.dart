import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme.dart';

/// Masuk sebagai tamu (anonymous sign-in Supabase) cukup dengan nama.
/// Aktifkan "Allow anonymous sign-ins" di Supabase > Authentication > Sign In / Providers.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _name = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final name = _name.text.trim();
    if (name.length < 2 || name.length > 24) {
      setState(() => _error = 'Nama 2 sampai 24 huruf ya.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInAnonymously(data: {'display_name': name});
    } on AuthException catch (e) {
      setState(() => _error = 'Gagal masuk: ${e.message}');
    } catch (e) {
      setState(() => _error = 'Gagal masuk. Cek koneksi internet.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('🇮🇩😭', textAlign: TextAlign.center, style: TextStyle(fontSize: 56)),
                  const SizedBox(height: 8),
                  Text(
                    'Negeri Wkwk',
                    textAlign: TextAlign.center,
                    style: titleFont(
                      size: 44,
                      color: Palette.gold,
                      shadows: const [Shadow(color: Palette.red, offset: Offset(3, 3))],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Bertahan hidup, saling jaga, lawan Pemerintah.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _name,
                    maxLength: 24,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _login(),
                    decoration: const InputDecoration(
                      labelText: 'Nama warga',
                      hintText: 'Misal: Budi Sabar',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _login,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(_busy ? 'Masuk…' : 'Masuk sebagai Warga'),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Game satire fiksi. Tidak mewakili lembaga, partai, atau tokoh nyata.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
