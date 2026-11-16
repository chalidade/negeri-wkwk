import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:negeri_wkwk/models/board.dart';
import 'package:negeri_wkwk/widgets/board_view.dart';

void main() {
  test('40 petak menempati keliling grid 11x11 tanpa tumpang tindih', () {
    final seen = <String>{};
    for (var i = 0; i < 40; i++) {
      final c = tileCell(i);
      final onEdge = c.row == 0 || c.row == 10 || c.col == 0 || c.col == 10;
      expect(onEdge, isTrue, reason: 'petak $i harus di pinggir');
      expect(seen.add('${c.row},${c.col}'), isTrue, reason: 'petak $i bertabrakan');
    }
    expect(tileCell(0), (row: 10, col: 10));
    expect(tileCell(10), (row: 10, col: 0));
    expect(tileCell(20), (row: 0, col: 0));
    expect(tileCell(30), (row: 0, col: 10));
  });

  test('board.json bisa dibaca dan berisi 40 petak berurutan', () {
    final raw = File('assets/board.json').readAsStringSync();
    final tiles = ((jsonDecode(raw) as Map)['tiles'] as List)
        .map((t) => TileDef.fromJson(Map<String, dynamic>.from(t as Map)))
        .toList();
    expect(tiles.length, 40);
    for (var i = 0; i < tiles.length; i++) {
      expect(tiles[i].index, i);
    }
  });
}
