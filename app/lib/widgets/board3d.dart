import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../models/board.dart';
import '../models/game_state.dart';
import '../theme.dart';
import 'board_view.dart';
import 'dice.dart';
import 'pawn.dart';

/// Papan 2.5D: bidang papan dimiringkan dengan perspektif, sementara pion dan
/// dadu digambar tegak di atasnya (diproyeksikan ke posisi petak).
class Board3D extends StatelessWidget {
  const Board3D({
    super.key,
    required this.board,
    required this.game,
    required this.onTapTile,
  });

  final Board board;
  final GameState game;
  final void Function(int index) onTapTile;

  /// Bagian atas kotak papan yang kosong setelah dimiringkan.
  static const _topTrim = 0.17;
  static const _visibleHeight = 0.78;

  static Matrix4 planeMatrix(double size) {
    final c = size / 2;
    final perspective = Matrix4.identity()..setEntry(3, 2, 0.0011);
    return Matrix4.translationValues(c, c, 0)
      ..multiply(perspective)
      ..multiply(Matrix4.rotationX(-0.62))
      ..multiply(Matrix4.diagonal3Values(0.86, 0.86, 1))
      ..multiply(Matrix4.translationValues(-c, -c, 0));
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.maxWidth;
        final matrix = planeMatrix(size);
        final top = -size * _topTrim;
        final pad = size * 0.025;
        final cell = (size - pad * 2) / 11;
        Offset project(Offset p) => MatrixUtils.transformPoint(matrix, p) + Offset(0, top);
        Offset tileCenter(int i) {
          final c = tileCell(i);
          return Offset(pad + (c.col + 0.5) * cell, pad + (c.row + 0.5) * cell);
        }

        final center = project(Offset(size / 2, size / 2));
        return SizedBox(
          width: size,
          height: size * _visibleHeight,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                top: top,
                width: size,
                height: size,
                child: Transform(
                  transform: matrix,
                  child: _BoardPlane(
                    board: board,
                    game: game,
                    cell: cell,
                    pad: pad,
                    onTapTile: onTapTile,
                  ),
                ),
              ),
              Positioned.fill(
                child: IgnorePointer(
                  child: PawnLayer(
                    game: game,
                    cell: cell,
                    project: project,
                    tileCenter: tileCenter,
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: center.dy + cell * 1.55,
                child: IgnorePointer(
                  child: Center(child: DicePair(values: game.lastDice, size: cell * 1.0)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Bidang papan (yang dimiringkan)
// ---------------------------------------------------------------------------

class _BoardPlane extends StatelessWidget {
  const _BoardPlane({
    required this.board,
    required this.game,
    required this.cell,
    required this.pad,
    required this.onTapTile,
  });

  final Board board;
  final GameState game;
  final double cell;
  final double pad;
  final void Function(int index) onTapTile;

  @override
  Widget build(BuildContext context) {
    final size = cell * 11 + pad * 2;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // ketebalan papan (sisi kayu yang terlihat di bawah)
        Positioned(
          left: 0,
          right: 0,
          top: size * 0.03,
          bottom: -size * 0.03,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Palette.woodDark,
              borderRadius: BorderRadius.circular(size * 0.04),
              boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 24, offset: Offset(0, 18))],
            ),
          ),
        ),
        // bingkai kayu
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFC08A52), Palette.wood, Color(0xFF7A4F27)],
              ),
              borderRadius: BorderRadius.circular(size * 0.04),
            ),
          ),
        ),
        // tengah papan
        Positioned(
          left: pad + cell,
          top: pad + cell,
          width: cell * 9,
          height: cell * 9,
          child: _BoardCenter(game: game, cell: cell),
        ),
        for (final tile in board.tiles) _tile(tile),
      ],
    );
  }

  Widget _tile(TileDef tile) {
    final c = tileCell(tile.index);
    return Positioned(
      left: pad + c.col * cell,
      top: pad + c.row * cell,
      width: cell,
      height: cell,
      child: GestureDetector(
        onTap: () => onTapTile(tile.index),
        child: Padding(
          padding: EdgeInsets.all(cell * 0.03),
          child: _Tile3D(
            tile: tile,
            state: game.tiles[tile.index],
            game: game,
            cell: cell,
            row: c.row,
            col: c.col,
          ),
        ),
      ),
    );
  }
}

class _BoardCenter extends StatelessWidget {
  const _BoardCenter({required this.game, required this.cell});

  final GameState game;
  final double cell;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const RadialGradient(
          colors: [Color(0xFFFFF7E3), Color(0xFFF3DDB0)],
        ),
        borderRadius: BorderRadius.circular(cell * 0.2),
        border: Border.all(color: const Color(0xFFD9B77A), width: 2),
      ),
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: _BatikPainter())),
          Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Padding(
                padding: EdgeInsets.all(cell * 0.4),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('🏛️ 🛵 🏪 🌾', style: TextStyle(fontSize: cell * 0.55)),
                    SizedBox(height: cell * 0.1),
                    Text(
                      'NEGERI',
                      style: titleFont(
                        size: cell * 0.95,
                        color: Palette.red,
                        shadows: const [Shadow(color: Color(0x55000000), offset: Offset(2, 3))],
                      ),
                    ),
                    Text(
                      'WKWK',
                      style: titleFont(
                        size: cell * 1.5,
                        color: Palette.woodDark,
                        shadows: const [Shadow(color: Palette.gold, offset: Offset(3, 3))],
                      ),
                    ),
                    SizedBox(height: cell * 0.25),
                    _Plaque(
                      cell: cell,
                      text: game.isRakyatBersatu
                          ? '🌾 Lumbung ₵${game.lumbung}   🏛️ Kas ₵${game.kasPemerintah}'
                          : '🏛️ Kas Pemerintah ₵${game.kasPemerintah}',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Plaque extends StatelessWidget {
  const _Plaque({required this.cell, required this.text});

  final double cell;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: cell * 0.35, vertical: cell * 0.12),
      decoration: BoxDecoration(
        color: Palette.woodDark,
        borderRadius: BorderRadius.circular(cell * 0.3),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: cell * 0.3, color: Palette.cream, fontWeight: FontWeight.w800),
      ),
    );
  }
}

/// Ornamen ala batik kawung sederhana di tengah papan.
class _BatikPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0x22A0522D);
    final step = size.width / 9;
    for (var x = 0.0; x <= size.width; x += step) {
      for (var y = 0.0; y <= size.height; y += step) {
        for (var k = 0; k < 4; k++) {
          final a = k * math.pi / 2 + math.pi / 4;
          final c = Offset(x + math.cos(a) * step * 0.22, y + math.sin(a) * step * 0.22);
          canvas.drawOval(Rect.fromCenter(center: c, width: step * 0.3, height: step * 0.3), paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

const _levelIcons = ['', '🏪', '🏬', '🏢'];

Color _cornerColor(String type) {
  switch (type) {
    case 'start':
      return const Color(0xFF2DBE6C);
    case 'jail':
      return const Color(0xFF546E7A);
    case 'posko':
      return const Color(0xFF3A86FF);
    case 'go_to_jail':
      return const Color(0xFFE63946);
    default:
      return Palette.cream;
  }
}

class _Tile3D extends StatelessWidget {
  const _Tile3D({
    required this.tile,
    required this.state,
    required this.game,
    required this.cell,
    required this.row,
    required this.col,
  });

  final TileDef tile;
  final TileState state;
  final GameState game;
  final double cell;
  final int row;
  final int col;

  bool get _isCorner => tile.index % 10 == 0;

  @override
  Widget build(BuildContext context) {
    final owner = state.owner;
    final ownerPlayer = owner == null ? null : game.players[owner];
    final ownerColor = owner == governmentId
        ? Colors.black
        : (ownerPlayer != null ? colorForSeat(ownerPlayer.seat) : null);
    final isTurnHere = !game.isOver && game.currentPlayer.position == tile.index;
    final banjir = state.disabledUntilRound >= game.round;
    final gov = tile.type == 'gov_seat';
    final base = _isCorner
        ? _cornerColor(tile.type)
        : (gov ? const Color(0xFF2B2B3A) : Palette.cream);
    final textColor = (_isCorner && tile.type != 'start') || gov ? Colors.white : const Color(0xFF3B2A1A);
    final radius = BorderRadius.circular(cell * 0.12);

    // Pita warna grup menghadap ke tengah papan.
    Widget? band;
    if (tile.group != null) {
      final bandColor = tileColor(tile);
      final t = cell * 0.2;
      if (row == 10) band = Positioned(left: 0, right: 0, top: 0, height: t, child: ColoredBox(color: bandColor));
      if (row == 0) band = Positioned(left: 0, right: 0, bottom: 0, height: t, child: ColoredBox(color: bandColor));
      if (col == 0) band = Positioned(top: 0, bottom: 0, right: 0, width: t, child: ColoredBox(color: bandColor));
      if (col == 10) band = Positioned(top: 0, bottom: 0, left: 0, width: t, child: ColoredBox(color: bandColor));
    }

    final emoji = tile.type == 'property' ? '' : tileEmoji(tile);
    final nameSize = cell * (_isCorner ? 0.14 : 0.13);

    return Container(
      decoration: BoxDecoration(
        color: base,
        borderRadius: radius,
        border: Border.all(
          color: isTurnHere ? Palette.gold : (ownerColor ?? const Color(0x33000000)),
          width: isTurnHere ? 3 : (ownerColor != null ? 2.5 : 1),
        ),
        boxShadow: [
          // sisi tebal petak
          BoxShadow(color: Color.lerp(base, Colors.black, 0.45)!, offset: Offset(0, cell * 0.06)),
          if (isTurnHere) const BoxShadow(color: Color(0xAAFFC94D), blurRadius: 10),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            if (band != null) band,
            Center(
              child: Padding(
                padding: EdgeInsets.all(cell * 0.06),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (emoji.isNotEmpty)
                      Text(emoji, style: TextStyle(fontSize: cell * (_isCorner ? 0.42 : 0.3))),
                    if (state.level > 0)
                      Text(_levelIcons[state.level], style: TextStyle(fontSize: cell * 0.3)),
                    Text(
                      tile.name,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: nameSize,
                        height: 1.05,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (banjir)
              Positioned.fill(
                child: ColoredBox(
                  color: const Color(0x663A86FF),
                  child: Center(child: Text('🌊', style: TextStyle(fontSize: cell * 0.4))),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pion yang melompat petak demi petak
// ---------------------------------------------------------------------------

class PawnLayer extends StatefulWidget {
  const PawnLayer({
    super.key,
    required this.game,
    required this.cell,
    required this.project,
    required this.tileCenter,
  });

  final GameState game;
  final double cell;
  final Offset Function(Offset) project;
  final Offset Function(int) tileCenter;

  @override
  State<PawnLayer> createState() => _PawnLayerState();
}

class _PawnLayerState extends State<PawnLayer> with SingleTickerProviderStateMixin {
  /// Posisi tampilan (boleh pecahan) per pemain.
  final Map<String, double> _shown = {};
  late final Ticker _ticker = createTicker(_tick);
  Duration _last = Duration.zero;

  static const _tilesPerSecond = 6.0;

  @override
  void initState() {
    super.initState();
    for (final p in widget.game.playersInOrder) {
      _shown[p.id] = p.position.toDouble();
    }
  }

  @override
  void didUpdateWidget(covariant PawnLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_settled() && !_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  double _remaining(String id) {
    final target = widget.game.players[id]?.position.toDouble() ?? 0;
    final pos = _shown[id] ?? target;
    return (target - pos) % 40;
  }

  bool _settled() => widget.game.players.keys.every((id) => _remaining(id) < 0.001);

  void _tick(Duration elapsed) {
    final dt = _last == Duration.zero ? 0.016 : (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    setState(() {
      for (final p in widget.game.playersInOrder) {
        final d = _remaining(p.id);
        if (d < 0.001) continue;
        if (d > 12.5) {
          // Pindah jauh (mis. diciduk ke Kena Tilang): langsung teleport.
          _shown[p.id] = p.position.toDouble();
          continue;
        }
        final step = math.min(d, dt * _tilesPerSecond);
        _shown[p.id] = ((_shown[p.id] ?? 0) + step) % 40;
      }
    });
    if (_settled()) _ticker.stop();
  }

  @override
  Widget build(BuildContext context) {
    final game = widget.game;
    final cell = widget.cell;
    final pawnSize = cell * 0.62;
    final players = game.playersInOrder.where((p) => !p.bankrupt).toList();

    // Hitung posisi layar dulu, lalu urutkan dari belakang ke depan.
    final placed = <({PlayerState p, Offset at, double scale})>[];
    for (final p in players) {
      final pos = _shown[p.id] ?? p.position.toDouble();
      final base = pos.floor() % 40;
      final frac = pos - pos.floor();
      final a = widget.tileCenter(base);
      final b = widget.tileCenter((base + 1) % 40);
      final spread = Offset(((p.seat % 3) - 1) * cell * 0.24, ((p.seat ~/ 3) - 0.5) * cell * 0.22);
      final plane = Offset.lerp(a, b, frac)! + spread;
      final screen = widget.project(plane);
      final hop = math.sin(frac * math.pi) * cell * 0.7;
      // Pion yang lebih dekat ke kamera (bawah) sedikit lebih besar.
      final depthScale = 0.85 + 0.3 * (plane.dy / (cell * 11));
      placed.add((p: p, at: screen - Offset(0, hop), scale: depthScale));
    }
    placed.sort((x, y) => x.at.dy.compareTo(y.at.dy));

    return Stack(
      clipBehavior: Clip.none,
      children: [
        for (final e in placed)
          Positioned(
            left: e.at.dx - pawnSize * e.scale / 2,
            top: e.at.dy - pawnSize * 1.35 * e.scale * 0.92,
            child: Pawn(
              color: colorForSeat(e.p.seat),
              size: pawnSize * e.scale,
              glow: !game.isOver && game.currentPlayerId == e.p.id,
            ),
          ),
      ],
    );
  }
}
