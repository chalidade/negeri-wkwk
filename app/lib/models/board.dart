import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

/// Definisi satu petak papan. Sumber datanya assets/board.json, salinan dari
/// supabase/functions/_shared/board.json (jalankan scripts/sync_board.sh).
class TileDef {
  const TileDef({
    required this.index,
    required this.name,
    required this.type,
    this.group,
    this.price,
    this.rent,
    this.amount,
    this.umkm = false,
  });

  final int index;
  final String name;
  final String type;
  final String? group;
  final int? price;
  final int? rent;
  final int? amount;
  final bool umkm;

  bool get isBuyable =>
      type == 'property' || type == 'transport' || type == 'utility';

  factory TileDef.fromJson(Map<String, dynamic> json) => TileDef(
        index: (json['index'] as num).toInt(),
        name: json['name'] as String,
        type: json['type'] as String,
        group: json['group'] as String?,
        price: (json['price'] as num?)?.toInt(),
        rent: (json['rent'] as num?)?.toInt(),
        amount: (json['amount'] as num?)?.toInt(),
        umkm: json['umkm'] == true,
      );
}

class Board {
  const Board(this.tiles);

  final List<TileDef> tiles;

  static Future<Board> load() async {
    final raw = await rootBundle.loadString('assets/board.json');
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final tiles = (data['tiles'] as List)
        .map((t) => TileDef.fromJson(Map<String, dynamic>.from(t as Map)))
        .toList();
    return Board(tiles);
  }
}

/// Warna grup properti dan petak spesial.
Color tileColor(TileDef t) {
  switch (t.group) {
    case 'coklat':
      return const Color(0xFF8D6E63);
    case 'biru_muda':
      return const Color(0xFF4FC3F7);
    case 'pink':
      return const Color(0xFFF06292);
    case 'oranye':
      return const Color(0xFFFFA726);
    case 'merah':
      return const Color(0xFFE53935);
    case 'kuning':
      return const Color(0xFFFDD835);
    case 'hijau':
      return const Color(0xFF43A047);
    case 'biru_tua':
      return const Color(0xFF1E3A8A);
  }
  switch (t.type) {
    case 'gov_seat':
      return const Color(0xFF263238);
    case 'tax':
      return const Color(0xFF78909C);
    case 'transport':
      return const Color(0xFF5D4037);
    case 'utility':
      return const Color(0xFF00897B);
    case 'card_nasib':
      return const Color(0xFF7E57C2);
    case 'card_wa':
      return const Color(0xFF25D366);
    default:
      return const Color(0xFFBDBDBD);
  }
}

/// Ikon kecil untuk petak non-properti.
String tileEmoji(TileDef t) {
  switch (t.type) {
    case 'start':
      return '💰';
    case 'card_wa':
      return '💬';
    case 'card_nasib':
      return '🎲';
    case 'tax':
      return '🧾';
    case 'transport':
      return '🚌';
    case 'utility':
      return t.name.contains('Listrik') ? '⚡' : '💧';
    case 'jail':
      return '🚓';
    case 'posko':
      return '🌊';
    case 'go_to_jail':
      return '🫵';
    case 'gov_seat':
      return '🪑';
    default:
      return '';
  }
}
