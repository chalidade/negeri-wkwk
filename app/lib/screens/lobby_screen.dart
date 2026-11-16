import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/game_state.dart';
import '../services/api.dart';
import 'game_screen.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key, required this.roomId});

  final String roomId;

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  final _api = GameApi.instance;
  late final Future<Map<String, dynamic>> _room = _api.fetchRoom(widget.roomId);
  late final Stream<List<Map<String, dynamic>>> _members = _api.watchMembers(widget.roomId);
  StreamSubscription<GameState?>? _gameSub;
  bool _starting = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    // Begitu state game muncul, semua anggota pindah ke layar permainan.
    _gameSub = _api.watchGame(widget.roomId).listen((game) {
      if (game != null && !_navigated && mounted) {
        _navigated = true;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => GameScreen(roomId: widget.roomId)),
        );
      }
    });
  }

  @override
  void dispose() {
    _gameSub?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() => _starting = true);
    try {
      await _api.startGame(widget.roomId);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Lobby')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _room,
        builder: (context, roomSnap) {
          if (roomSnap.hasError) {
            return Center(child: Text('Gagal memuat room: ${roomSnap.error}'));
          }
          final room = roomSnap.data;
          if (room == null) return const Center(child: CircularProgressIndicator());
          final code = room['code'] as String;
          final isHost = room['host_id'] == _api.userId;
          final maxPlayers = (room['max_players'] as num).toInt();
          final isRakyat = room['mode'] == 'rakyat_bersatu';

          return StreamBuilder<List<Map<String, dynamic>>>(
            stream: _members,
            builder: (context, snap) {
              if (snap.hasError) {
                return Center(child: Text('Koneksi realtime bermasalah: ${snap.error}'));
              }
              final members = snap.data ?? const [];
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text('Kode room', style: theme.textTheme.labelLarge, textAlign: TextAlign.center),
                  InkWell(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: code));
                      ScaffoldMessenger.of(context)
                          .showSnackBar(const SnackBar(content: Text('Kode disalin')));
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        code,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.displaySmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 6,
                        ),
                      ),
                    ),
                  ),
                  Text(
                    'Ketuk kode untuk menyalin, lalu share ke grup.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isRakyat ? 'Mode: Rakyat Bersatu' : 'Mode: Juragan',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  Text('Warga (${members.length}/$maxPlayers)', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  for (final m in members)
                    Card(
                      child: ListTile(
                        leading: Text(
                          professionEmoji[m['profession']] ?? '🎰',
                          style: const TextStyle(fontSize: 28),
                        ),
                        title: Text(m['display_name'] as String),
                        subtitle: Text(professionLabels[m['profession']] ?? 'Profesi acak'),
                        trailing: m['user_id'] == room['host_id'] ? const Text('👑 Host') : null,
                      ),
                    ),
                  const SizedBox(height: 24),
                  if (isHost)
                    FilledButton(
                      onPressed: members.length >= 2 && !_starting ? _start : null,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          members.length < 2
                              ? 'Tunggu minimal 2 warga'
                              : (_starting ? 'Memulai…' : 'Mulai Permainan'),
                        ),
                      ),
                    )
                  else
                    const Text('Menunggu host memulai permainan…', textAlign: TextAlign.center),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
