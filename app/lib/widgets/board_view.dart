import 'package:flutter/material.dart';

import '../models/board.dart';
import '../models/game_state.dart';

const playerColors = <Color>[
  Color(0xFFE53935),
  Color(0xFF1E88E5),
  Color(0xFF43A047),
  Color(0xFFFB8C00),
  Color(0xFF8E24AA),
  Color(0xFF00ACC1),
];

Color colorForSeat(int seat) => playerColors[seat % playerColors.length];

/// Posisi petak di grid 11x11. Petak 0 (Gajian) di pojok kanan bawah,
/// lalu berjalan searah jarum jam: bawah, kiri, atas, kanan.
({int row, int col}) tileCell(int index) {
  if (index <= 10) return (row: 10, col: 10 - index);
  if (index <= 20) return (row: 20 - index, col: 0);
  if (index <= 30) return (row: 0, col: index - 20);
  return (row: index - 30, col: 10);
}

class BoardView extends StatelessWidget {
  const BoardView({
    super.key,
    required this.board,
    required this.game,
    required this.onTapTile,
    this.center,
  });

  final Board board;
  final GameState game;
  final void Function(int index) onTapTile;
  final Widget? center;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cell = constraints.maxWidth / 11;
          return Stack(
            children: [
              Positioned(
                left: cell,
                top: cell,
                width: cell * 9,
                height: cell * 9,
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8E1),
                    border: Border.all(color: Colors.black26),
                  ),
                  child: center,
                ),
              ),
              for (final tile in board.tiles)
                _positioned(tile, cell),
            ],
          );
        },
      ),
    );
  }

  Widget _positioned(TileDef tile, double cell) {
    final pos = tileCell(tile.index);
    final playersHere = game.playersInOrder
        .where((p) => !p.bankrupt && p.position == tile.index)
        .toList();
    return Positioned(
      left: pos.col * cell,
      top: pos.row * cell,
      width: cell,
      height: cell,
      child: GestureDetector(
        onTap: () => onTapTile(tile.index),
        child: _TileBox(
          tile: tile,
          state: game.tiles[tile.index],
          game: game,
          players: playersHere,
          cell: cell,
        ),
      ),
    );
  }
}

class _TileBox extends StatelessWidget {
  const _TileBox({
    required this.tile,
    required this.state,
    required this.game,
    required this.players,
    required this.cell,
  });

  final TileDef tile;
  final TileState state;
  final GameState game;
  final List<PlayerState> players;
  final double cell;

  @override
  Widget build(BuildContext context) {
    final owner = state.owner;
    final ownerPlayer = owner == null ? null : game.players[owner];
    final ownerColor = owner == governmentId
        ? Colors.black
        : (ownerPlayer != null ? colorForSeat(ownerPlayer.seat) : null);
    final isTurnHere = game.currentPlayer.position == tile.index && !game.isOver;
    final banjir = state.disabledUntilRound >= game.round;
    final fontSize = (cell * 0.13).clamp(5.0, 11.0);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(
          color: isTurnHere ? Colors.amber.shade700 : Colors.black26,
          width: isTurnHere ? 2 : 0.5,
        ),
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (tile.group != null)
                Container(height: cell * 0.16, color: tileColor(tile)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(1),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (tileEmoji(tile).isNotEmpty)
                        Text(tileEmoji(tile), style: TextStyle(fontSize: fontSize * 1.4)),
                      Flexible(
                        child: Text(
                          tile.name,
                          textAlign: TextAlign.center,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: fontSize, height: 1.05),
                        ),
                      ),
                      if (state.level > 0)
                        Text('★' * state.level,
                            style: TextStyle(fontSize: fontSize, color: Colors.orange.shade800)),
                    ],
                  ),
                ),
              ),
              if (ownerColor != null) Container(height: cell * 0.08, color: ownerColor),
            ],
          ),
          if (banjir)
            Positioned(
              right: 1,
              top: 1,
              child: Text('🌊', style: TextStyle(fontSize: fontSize)),
            ),
          if (players.isNotEmpty)
            Positioned(
              left: 1,
              bottom: cell * 0.1,
              right: 1,
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: 1,
                runSpacing: 1,
                children: [
                  for (final p in players)
                    Container(
                      width: cell * 0.24,
                      height: cell * 0.24,
                      decoration: BoxDecoration(
                        color: colorForSeat(p.seat),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1),
                        boxShadow: const [BoxShadow(blurRadius: 1, color: Colors.black45)],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
