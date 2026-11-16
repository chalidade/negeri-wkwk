import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/board.dart';
import '../models/event_text.dart';
import '../models/game_state.dart';
import '../models/rules_mirror.dart' as rules;
import '../services/api.dart';
import '../theme.dart';
import '../widgets/board3d.dart';
import '../widgets/board_view.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({super.key, required this.roomId});

  final String roomId;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  final _api = GameApi.instance;
  late final Future<Board> _board = Board.load();
  late final Future<PlayerSecret?> _secret = _api.mySecret(widget.roomId);
  late final Stream<GameState?> _game = _api.watchGame(widget.roomId);
  late final Stream<List<GameEventRow>> _events = _api.watchEvents(widget.roomId);
  bool _busy = false;

  String get _me => _api.userId;

  Future<void> _send(GameState game, Map<String, dynamic> action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await _api.sendAction(widget.roomId, game.version, action);
      HapticFeedback.lightImpact();
    } on ApiException catch (e) {
      if (!e.isStale && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Koneksi bermasalah, coba lagi.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<int?> _askAmount(String title, int max) async {
    final ctrl = TextEditingController();
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(prefixText: '₵ ', helperText: 'Maksimal ₵$max'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, int.tryParse(ctrl.text)),
            child: const Text('OK'),
          ),
        ],
      ),
    );
    if (result == null || result <= 0) return null;
    return result > max ? max : result;
  }

  void _showTile(Board board, GameState game, int index) {
    final tile = board.tiles[index];
    final state = game.tiles[index];
    final owner = state.owner == null
        ? 'Belum dimiliki'
        : (state.owner == governmentId ? 'Pemerintah' : game.players[state.owner]?.name ?? '-');
    final mine = state.owner == _me;
    final canUpgrade = mine &&
        tile.type == 'property' &&
        state.level < rules.maxLevel &&
        game.currentPlayerId == _me &&
        (game.phase == 'awaiting_roll' || game.phase == 'awaiting_end');
    final upgradeCost = game.scaled((tile.price ?? 0) * rules.biayaUpgrade);

    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(width: 16, height: 16, color: tileColor(tile)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(tile.name, style: Theme.of(ctx).textTheme.titleLarge),
                ),
              ]),
              const SizedBox(height: 8),
              if (tile.price != null) Text('Harga sekarang: ₵${game.scaled(tile.price!)}'),
              if (tile.rent != null) Text('Sewa dasar: ₵${game.scaled(tile.rent!)}'),
              if (tile.isBuyable || tile.type == 'gov_seat') Text('Pemilik: $owner'),
              if (tile.type == 'property' && state.owner != null)
                Text('Level: ${levelLabels[state.level]}'),
              if (tile.umkm) const Text('Usaha UMKM'),
              if (canUpgrade) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _send(game, {'type': 'upgrade', 'tile': index});
                  },
                  icon: const Icon(Icons.upgrade),
                  label: Text('Upgrade jadi ${levelLabels[state.level + 1]} (₵$upgradeCost)'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Board>(
      future: _board,
      builder: (context, boardSnap) {
        final board = boardSnap.data;
        return StreamBuilder<GameState?>(
          stream: _game,
          builder: (context, gameSnap) {
            if (gameSnap.hasError) {
              return Scaffold(
                appBar: AppBar(),
                body: Center(child: Text('Koneksi realtime bermasalah: ${gameSnap.error}')),
              );
            }
            final game = gameSnap.data;
            if (board == null || game == null) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }
            return Scaffold(
              appBar: AppBar(
                titleSpacing: 12,
                title: Row(children: [
                  _HudChip(icon: '🗓️', text: 'Ronde ${game.round}/${game.maxRounds}'),
                  const SizedBox(width: 8),
                  _HudChip(icon: '📈', text: 'Inflasi ${game.inflationLevel}'),
                ]),
              ),
              body: ListView(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 16),
                children: [
                  if (game.isOver) _GameOverCard(game: game, me: _me),
                  if (game.isRakyatBersatu) _Meters(game: game),
                  const SizedBox(height: 4),
                  Board3D(
                    board: board,
                    game: game,
                    onTapTile: (i) => _showTile(board, game, i),
                  ),
                  const SizedBox(height: 4),
                  _PlayersRow(game: game),
                  const SizedBox(height: 10),
                  FutureBuilder<PlayerSecret?>(
                    future: _secret,
                    builder: (context, s) => _MyPanel(game: game, me: _me, secret: s.data),
                  ),
                  const SizedBox(height: 10),
                  _EventLog(stream: _events, game: game, board: board),
                ],
              ),
              bottomNavigationBar: game.isOver
                  ? null
                  : SafeArea(child: _actionBar(board, game)),
            );
          },
        );
      },
    );
  }

  Widget _actionBar(Board board, GameState game) {
    final me = game.players[_me];
    if (me == null) return const SizedBox.shrink();
    final myTurn = game.currentPlayerId == _me && !me.bankrupt;

    if (me.bankrupt) {
      return const _BarMessage('💀 Kamu bangkrut. Dukung teman lewat chat ya.');
    }
    if (!myTurn) {
      return _BarMessage('⏳ Giliran ${game.currentPlayer.name}…');
    }

    final buttons = <Widget>[];
    void add(String label, VoidCallback? onTap, {bool primary = false}) {
      buttons.add(Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: GameButton(
          label: label,
          onPressed: _busy ? null : onTap,
          color: primary ? Palette.gold : const Color(0xFF5B3A8C),
          textColor: primary ? Colors.black : Colors.white,
          small: !primary,
        ),
      ));
    }

    switch (game.phase) {
      case 'awaiting_roll':
        add('🎲 Lempar Dadu', () => _send(game, {'type': 'roll'}), primary: true);
        if (me.jailTurns > 0) {
          add('🧾 Bayar Denda ₵${game.scaled(rules.dendaTilang)}',
              () => _send(game, {'type': 'bayar_denda'}));
        }
      case 'awaiting_buy':
        final idx = game.pendingTile;
        if (idx != null) {
          final price = game.scaled(board.tiles[idx].price ?? 0);
          add('🏪 Beli ₵$price', me.cuan >= price ? () => _send(game, {'type': 'buy'}) : null,
              primary: true);
          add('Lewati', () => _send(game, {'type': 'skip_buy'}));
        }
      case 'awaiting_end':
        add('✅ Akhiri Giliran', () => _send(game, {'type': 'end_turn'}), primary: true);
    }

    final canSide = game.phase == 'awaiting_roll' || game.phase == 'awaiting_end';
    if (canSide) {
      if (game.isRakyatBersatu && !game.aksiDipakai) {
        add('✍️ Petisi ₵${game.scaled(rules.petisiBiaya)}', () => _send(game, {'type': 'petisi'}));
        if (game.lumbung >= rules.liputanBiayaLumbung) {
          add('📰 Liputan Media', () => _send(game, {'type': 'liputan_media'}));
        }
      }
      if (game.isRakyatBersatu) {
        add('🌾 Donasi', () async {
          final n = await _askAmount('Donasi ke Lumbung Bersama', me.cuan);
          if (n != null) _send(game, {'type': 'donasi_lumbung', 'amount': n});
        });
      }
      add('🐷 Nabung', () async {
        final n = await _askAmount('Setor ke Tabungan Darurat', me.cuan);
        if (n != null) _send(game, {'type': 'setor_tabungan', 'amount': n});
      });
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xCC170E2E),
        border: Border(top: BorderSide(color: Palette.panelBorder)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: buttons),
      ),
    );
  }
}

class _BarMessage extends StatelessWidget {
  const _BarMessage(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        color: const Color(0xCC170E2E),
        child: Text(text, textAlign: TextAlign.center, style: titleFont(size: 16)),
      );
}

class _HudChip extends StatelessWidget {
  const _HudChip({required this.icon, required this.text});
  final String icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Palette.panel,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Palette.panelBorder),
      ),
      child: Text('$icon $text', style: titleFont(size: 15)),
    );
  }
}

class _Meters extends StatelessWidget {
  const _Meters({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    Widget bar(String icon, String label, int value, Color color) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                Text(icon, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$label $value', style: titleFont(size: 13)),
                      const SizedBox(height: 3),
                      Container(
                        height: 12,
                        decoration: BoxDecoration(
                          color: Colors.black38,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white24),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: (value / 100).clamp(0.0, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color.lerp(color, Colors.white, 0.35)!, color],
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
    return Row(children: [
      bar('✊', 'Gerakan', game.gerakan, Palette.red),
      bar('😤', 'Kesabaran', game.kesabaran, const Color(0xFFFF9F1C)),
    ]);
  }
}

class _PlayersRow extends StatelessWidget {
  const _PlayersRow({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final p in game.playersInOrder)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _PlayerPill(
                player: p,
                active: !game.isOver && p.id == game.currentPlayerId,
              ),
            ),
        ],
      ),
    );
  }
}

class _PlayerPill extends StatelessWidget {
  const _PlayerPill({required this.player, required this.active});
  final PlayerState player;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = colorForSeat(player.seat);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
      decoration: BoxDecoration(
        color: active ? color.withValues(alpha: 0.35) : Palette.panel,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: active ? Palette.gold : Palette.panelBorder, width: active ? 2 : 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: color,
            child: Text(professionEmoji[player.profession] ?? '🙂', style: const TextStyle(fontSize: 16)),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                player.bankrupt ? '💀 ${player.name}' : player.name,
                style: titleFont(size: 13).copyWith(
                  decoration: player.bankrupt ? TextDecoration.lineThrough : null,
                ),
              ),
              Text(
                '₵${player.cuan}${player.jailTurns > 0 ? '  🚓' : ''}',
                style: const TextStyle(fontSize: 12, color: Palette.gold, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MyPanel extends StatelessWidget {
  const _MyPanel({required this.game, required this.me, required this.secret});
  final GameState game;
  final String me;
  final PlayerSecret? secret;

  @override
  Widget build(BuildContext context) {
    final p = game.players[me];
    if (p == null) return const SizedBox.shrink();
    Widget stat(String icon, String label, String value) => Expanded(
          child: Column(
            children: [
              Text(icon, style: const TextStyle(fontSize: 22)),
              Text(value, style: titleFont(size: 16, color: Palette.gold)),
              Text(label, style: const TextStyle(fontSize: 11, color: Colors.white70)),
            ],
          ),
        );
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text('${professionEmoji[p.profession]} ', style: const TextStyle(fontSize: 22)),
            Text(professionLabels[p.profession] ?? '', style: titleFont(size: 18)),
            const Spacer(),
            if (secret != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: secret!.isBuzzer ? Palette.red : Palette.green,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(secret!.isBuzzer ? '🕵️ BUZZER' : '✊ RAKYAT', style: titleFont(size: 13)),
              ),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            stat('💰', 'Cuan', '₵${p.cuan}'),
            stat('🐷', 'Tabungan', '₵${p.tabungan}'),
            stat('🗳️', 'Suara', '${p.suaraRakyat}'),
            stat('🤫', 'Curiga', '${p.kecurigaan}'),
          ]),
          if (secret != null) ...[
            const SizedBox(height: 10),
            Text('🌟 Mimpi pribadi: ${mimpiLabels[secret!.mimpi] ?? secret!.mimpi}',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
          if (secret?.isBuzzer == true)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                'Rahasiakan peranmu! Tugasmu: jaga rezim tetap berkuasa.',
                style: TextStyle(fontSize: 12, color: Color(0xFFFFA8A8)),
              ),
            ),
        ],
      ),
    );
  }
}

class _EventLog extends StatelessWidget {
  const _EventLog({required this.stream, required this.game, required this.board});
  final Stream<List<GameEventRow>> stream;
  final GameState game;
  final Board board;

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: StreamBuilder<List<GameEventRow>>(
        stream: stream,
        builder: (context, snap) {
          final lines = (snap.data ?? const <GameEventRow>[])
              .map((e) => describeEvent(e, game, board))
              .whereType<String>()
              .take(25)
              .toList();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('📢 Kabar Terkini', style: titleFont(size: 17)),
              const SizedBox(height: 8),
              if (lines.isEmpty) const Text('Belum ada kabar.'),
              for (var i = 0; i < lines.length; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(
                    lines[i],
                    style: TextStyle(
                      fontSize: 13,
                      color: i == 0 ? Colors.white : Colors.white70,
                      fontWeight: i == 0 ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Ringkasan Akhir Match: hasil dan peringkat. Bagian yang nantinya bisa di-share.
class _GameOverCard extends StatelessWidget {
  const _GameOverCard({required this.game, required this.me});
  final GameState game;
  final String me;

  @override
  Widget build(BuildContext context) {
    final result = game.result ?? const <String, dynamic>{};
    final menang = result['kind'] == 'rakyat_menang' ||
        (result['kind'] == 'juragan_menang' && result['winner'] == me);
    final ranking = [...game.playersInOrder]
      ..sort((a, b) => (b.cuan + b.tabungan).compareTo(a.cuan + a.tabungan));

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: menang
                ? [const Color(0xFF1E7F4A), Palette.green]
                : [const Color(0xFF7A1C2A), Palette.red],
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Palette.gold, width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(menang ? '🎉 ${resultText(result)}' : '😭 ${resultText(result)}',
                style: titleFont(size: 22)),
            const SizedBox(height: 8),
            Text('Bertahan sampai ronde ${game.round}. Meter Gerakan akhir: ${game.gerakan}/${rules.gerakanMenang}.'),
            const SizedBox(height: 8),
            for (final p in ranking)
              Text(
                '${p.bankrupt ? '💀' : '🧍'} ${p.name}: ₵${p.cuan + p.tabungan}'
                '${p.bankrupt ? ' (bangkrut)' : ''}',
              ),
            const SizedBox(height: 8),
            const Text('💡 Tips: sisihkan Tabungan Darurat 3x gaji, dan jauhi pinjol ilegal.'),
            const SizedBox(height: 12),
            GameButton(
              label: 'Kembali ke Beranda',
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            ),
          ],
        ),
      ),
    );
  }
}
