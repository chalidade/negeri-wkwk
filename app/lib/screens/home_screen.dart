import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/game_state.dart';
import '../services/api.dart';
import 'lobby_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _code = TextEditingController();
  String? _profession; // null = acak
  String _mode = 'rakyat_bersatu';
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _toast(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  Future<void> _run(Future<String> Function() task) async {
    setState(() => _busy = true);
    try {
      final roomId = await task();
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LobbyScreen(roomId: roomId)),
      );
    } on ApiException catch (e) {
      _toast(e.message);
    } catch (_) {
      _toast('Gagal terhubung ke server.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() => _run(() async {
        final res = await GameApi.instance.createRoom(mode: _mode, profession: _profession);
        return res.roomId;
      });

  Future<void> _join() {
    final code = _code.text.trim().toUpperCase();
    if (code.length != 6) {
      _toast('Kode room 6 karakter.');
      return Future.value();
    }
    return _run(() => GameApi.instance.joinRoom(code: code, profession: _profession));
  }

  Future<void> _confirmDeleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus akun?'),
        content: const Text(
          'Akun dan semua data permainanmu akan dihapus permanen. Ini nggak bisa dibatalkan.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Hapus')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await GameApi.instance.deleteAccount();
      await Supabase.instance.client.auth.signOut();
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final name = user?.userMetadata?['display_name'] as String? ?? 'Warga';
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Negeri Wkwk'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'keluar') Supabase.instance.client.auth.signOut();
              if (v == 'hapus') _confirmDeleteAccount();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'keluar', child: Text('Keluar')),
              PopupMenuItem(value: 'hapus', child: Text('Hapus akun')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Halo, $name 👋', style: theme.textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text('Pilih profesi, lalu bikin room atau gabung pakai kode.'),
            const SizedBox(height: 20),
            DropdownButtonFormField<String?>(
              initialValue: _profession,
              decoration: const InputDecoration(labelText: 'Profesi', border: OutlineInputBorder()),
              items: [
                const DropdownMenuItem(value: null, child: Text('🎰 Acak')),
                for (final e in professionLabels.entries)
                  DropdownMenuItem(
                    value: e.key,
                    child: Text('${professionEmoji[e.key]} ${e.value}'),
                  ),
              ],
              onChanged: _busy ? null : (v) => setState(() => _profession = v),
            ),
            const SizedBox(height: 24),
            Text('Bikin room baru', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'rakyat_bersatu', label: Text('Rakyat Bersatu')),
                ButtonSegment(value: 'juragan', label: Text('Juragan')),
              ],
              selected: {_mode},
              onSelectionChanged: _busy ? null : (s) => setState(() => _mode = s.first),
            ),
            const SizedBox(height: 4),
            Text(
              _mode == 'rakyat_bersatu'
                  ? 'Semua satu tim melawan Pemerintah. Hati-hati ada Buzzer (5+ pemain).'
                  : 'Saling bersaing jadi juragan, Pemerintah tetap mengganggu.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _busy ? null : _create,
              icon: const Icon(Icons.add),
              label: const Text('Bikin Room'),
            ),
            const SizedBox(height: 28),
            Text('Gabung room teman', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _code,
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: 'Kode room',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                    onSubmitted: (_) => _join(),
                  ),
                ),
                const SizedBox(width: 12),
                FilledButton.tonal(
                  onPressed: _busy ? null : _join,
                  child: const Text('Gabung'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
