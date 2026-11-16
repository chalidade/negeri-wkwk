import 'package:flutter/material.dart';

const playerColors = <Color>[
  Color(0xFFE63946),
  Color(0xFF3A86FF),
  Color(0xFF2DBE6C),
  Color(0xFFFF9F1C),
  Color(0xFF9B5DE5),
  Color(0xFF00BBF9),
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
