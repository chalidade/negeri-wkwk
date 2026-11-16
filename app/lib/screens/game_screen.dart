import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/board.dart';
import '../models/event_text.dart';
import '../models/game_state.dart';
import '../models/rules_mirror.dart' as rules;
import '../services/api.dart';
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
            final game = gameSnap.data;
            if (board == null || game == null) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }
            return Scaffold(
              appBar: AppBar(
                title: Text('Ronde ${game.round}/${game.maxRounds}'),
                actions: [
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Center(child: Text('📈 Inflasi ${game.inflationLevel}')),
                  ),
                ],
              ),
              body: ListView(
                padding: const EdgeInsets.fromLTRB(8, 4, 8, 16),
                children: [
                  if (game.isOver) _GameOverCard(game: game, me: _me),
                  if (game.isRakyatBersatu) _Meters(game: game),
                  const SizedBox(height: 6),
                  BoardView(
                    board: board,
                    game: game,
                    onTapTile: (i) => _showTile(board, game, i),
                    center: _BoardCenter(game: game),
                  ),
                  const SizedBox(height: 8),
                  _PlayersRow(game: game),
                  const SizedBox(height: 8),
                  FutureBuilder<PlayerSecret?>(
                    future: _secret,
                    builder: (context, s) => _MyPanel(game: game, me: _me, secret: s.data),
                  ),
                  const SizedBox(height: 8),
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
        child: primary
            ? FilledButton(onPressed: _busy ? null : onTap, child: Text(label))
            : OutlinedButton(onPressed: _busy ? null : onTap, child: Text(label)),
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

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(children: buttons),
      ),
    );
  }
}

class _BarMessage extends StatelessWidget {
  const _BarMessage(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text, textAlign: TextAlign.center),
      );
}

class _Meters extends StatelessWidget {
  const _Meters({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    Widget bar(String label, int value, Color color) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$label $value', style: const TextStyle(fontSize: 12)),
                const SizedBox(height: 2),
                LinearProgressIndicator(
                  value: value / 100,
                  color: color,
                  backgroundColor: color.withValues(alpha: 0.15),
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(4),
                ),
              ],
            ),
          ),
        );
    return Row(children: [
      bar('✊ Gerakan', game.gerakan, Colors.red.shade700),
      bar('😤 Kesabaran', game.kesabaran, Colors.orange.shade700),
    ]);
  }
}

class _BoardCenter extends StatelessWidget {
  const _BoardCenter({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final dice = game.lastDice;
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('NEGERI WKWK',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22, letterSpacing: 2)),
            const SizedBox(height: 8),
            if (dice != null && dice.length == 2)
              Text('🎲 ${dice[0]}  🎲 ${dice[1]}', style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 8),
            if (game.isRakyatBersatu) Text('🌾 Lumbung Bersama ₵${game.lumbung}'),
            Text('🏛️ Kas Pemerintah ₵${game.kasPemerintah}'),
          ],
        ),
      ),
    );
  }
}

class _PlayersRow extends StatelessWidget {
  const _PlayersRow({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final p in game.playersInOrder)
          Chip(
            avatar: CircleAvatar(backgroundColor: colorForSeat(p.seat), radius: 8),
            side: p.id == game.currentPlayerId && !game.isOver
                ? BorderSide(color: Colors.amber.shade700, width: 2)
                : null,
            label: Text(
              '${professionEmoji[p.profession] ?? ''} ${p.name} ₵${p.cuan}'
              '${p.jailTurns > 0 ? ' 🚓' : ''}',
              style: TextStyle(
                decoration: p.bankrupt ? TextDecoration.lineThrough : null,
                fontSize: 12,
              ),
            ),
          ),
      ],
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
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text('${professionEmoji[p.profession]} ${professionLabels[p.profession]}',
                  style: theme.textTheme.titleMedium),
              const Spacer(),
              if (secret != null)
                Chip(
                  label: Text(secret!.isBuzzer ? '🕵️ Kamu BUZZER' : '✊ Rakyat'),
                  backgroundColor: secret!.isBuzzer ? Colors.red.shade100 : Colors.green.shade100,
                ),
            ]),
            const SizedBox(height: 4),
            Text('💰 Cuan ₵${p.cuan}   🐷 Tabungan ₵${p.tabungan}'),
            Text('🗳️ Suara Rakyat ${p.suaraRakyat}   🤫 Kecurigaan ${p.kecurigaan}   🎟️ Ordal ${p.ordal}'),
            if (secret != null)
              Text('🌟 Mimpi pribadi: ${mimpiLabels[secret!.mimpi] ?? secret!.mimpi}'),
            if (secret?.isBuzzer == true)
              Text(
                'Rahasiakan peranmu! Tugasmu: jaga rezim tetap berkuasa. Kemampuan Buzzer menyusul.',
                style: theme.textTheme.bodySmall?.copyWith(color: Colors.red.shade800),
              ),
          ],
        ),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
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
                Text('Kabar Terkini', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                if (lines.isEmpty) const Text('Belum ada kabar.'),
                for (final l in lines)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(l, style: const TextStyle(fontSize: 13)),
                  ),
              ],
            );
          },
        ),
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

    return Card(
      color: menang ? Colors.green.shade50 : Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(menang ? '🎉 ${resultText(result)}' : '😭 ${resultText(result)}',
                style: Theme.of(context).textTheme.titleLarge),
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
            FilledButton(
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
              child: const Text('Kembali ke Beranda'),
            ),
          ],
        ),
      ),
    );
  }
}
