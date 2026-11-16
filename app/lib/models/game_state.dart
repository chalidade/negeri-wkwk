// Model state permainan. Bentuknya mengikuti GameState di
// supabase/functions/_shared/engine/types.ts.

int _int(Object? v) => (v as num?)?.toInt() ?? 0;

const governmentId = 'pemerintah';

const professionLabels = <String, String>{
  'buruh': 'Buruh Pabrik',
  'pedagang': 'Pedagang UMKM',
  'ojol': 'Ojol / Kurir',
  'kreator': 'Kreator Konten',
  'jurnalis': 'Jurnalis',
  'mahasiswa': 'Mahasiswa',
};

const professionEmoji = <String, String>{
  'buruh': '🏭',
  'pedagang': '🏪',
  'ojol': '🛵',
  'kreator': '📱',
  'jurnalis': '📰',
  'mahasiswa': '🎓',
};

const mimpiLabels = <String, String>{
  'beli_rumah': 'Beli rumah',
  'naik_haji': 'Naik haji',
  'nyekolahin_adik': 'Nyekolahin adik',
  'buka_cabang_ketiga': 'Buka cabang ke-3',
  'pensiun_tenang': 'Pensiun tenang',
  'nikah_tanpa_utang': 'Nikah tanpa utang',
};

const levelLabels = ['Lapak', 'Toko', 'Cabang', 'Brand Lokal'];

class PlayerState {
  const PlayerState({
    required this.id,
    required this.name,
    required this.seat,
    required this.profession,
    required this.position,
    required this.cuan,
    required this.tabungan,
    required this.kecurigaan,
    required this.jailTurns,
    required this.skipNext,
    required this.bankrupt,
    required this.suaraRakyat,
    required this.ordal,
  });

  final String id;
  final String name;
  final int seat;
  final String profession;
  final int position;
  final int cuan;
  final int tabungan;
  final int kecurigaan;
  final int jailTurns;
  final bool skipNext;
  final bool bankrupt;
  final int suaraRakyat;
  final int ordal;

  factory PlayerState.fromJson(Map<String, dynamic> j) => PlayerState(
        id: j['id'] as String,
        name: j['name'] as String,
        seat: _int(j['seat']),
        profession: j['profession'] as String,
        position: _int(j['position']),
        cuan: _int(j['cuan']),
        tabungan: _int(j['tabungan']),
        kecurigaan: _int(j['kecurigaan']),
        jailTurns: _int(j['jailTurns']),
        skipNext: j['skipNext'] == true,
        bankrupt: j['bankrupt'] == true,
        suaraRakyat: _int(j['suaraRakyat']),
        ordal: _int(j['ordal']),
      );
}

class TileState {
  const TileState({
    required this.owner,
    required this.level,
    required this.disabledUntilRound,
  });

  final String? owner;
  final int level;
  final int disabledUntilRound;

  factory TileState.fromJson(Map<String, dynamic> j) => TileState(
        owner: j['owner'] as String?,
        level: _int(j['level']),
        disabledUntilRound: _int(j['disabledUntilRound']),
      );
}

class GameState {
  const GameState({
    required this.version,
    required this.mode,
    required this.round,
    required this.maxRounds,
    required this.order,
    required this.turn,
    required this.players,
    required this.tiles,
    required this.inflationLevel,
    required this.gerakan,
    required this.kesabaran,
    required this.lumbung,
    required this.kasPemerintah,
    required this.phase,
    required this.pendingTile,
    required this.lastDice,
    required this.aksiDipakai,
    required this.result,
  });

  final int version;
  final String mode;
  final int round;
  final int maxRounds;
  final List<String> order;
  final int turn;
  final Map<String, PlayerState> players;
  final List<TileState> tiles;
  final int inflationLevel;
  final int gerakan;
  final int kesabaran;
  final int lumbung;
  final int kasPemerintah;
  final String phase;
  final int? pendingTile;
  final List<int>? lastDice;
  final bool aksiDipakai;
  final Map<String, dynamic>? result;

  bool get isRakyatBersatu => mode == 'rakyat_bersatu';
  bool get isOver => phase == 'game_over';
  String get currentPlayerId => order[turn];
  PlayerState get currentPlayer => players[currentPlayerId]!;

  /// Pengali harga dari Meteran Inflasi (sama dengan rules.ts).
  double get inflationMultiplier => 1 + inflationLevel * 0.1;
  int scaled(num amount) => (amount * inflationMultiplier).round();

  List<PlayerState> get playersInOrder =>
      order.map((id) => players[id]!).toList();

  factory GameState.fromRow(Map<String, dynamic> row) {
    final s = Map<String, dynamic>.from(row['state'] as Map);
    final playersJson = Map<String, dynamic>.from(s['players'] as Map);
    final dice = s['lastDice'] as List?;
    return GameState(
      version: _int(row['version']),
      mode: s['mode'] as String,
      round: _int(s['round']),
      maxRounds: _int(s['maxRounds']),
      order: (s['order'] as List).cast<String>(),
      turn: _int(s['turn']),
      players: playersJson.map(
        (k, v) => MapEntry(k, PlayerState.fromJson(Map<String, dynamic>.from(v as Map))),
      ),
      tiles: (s['tiles'] as List)
          .map((t) => TileState.fromJson(Map<String, dynamic>.from(t as Map)))
          .toList(),
      inflationLevel: _int(s['inflationLevel']),
      gerakan: _int(s['gerakan']),
      kesabaran: _int(s['kesabaran']),
      lumbung: _int(s['lumbung']),
      kasPemerintah: _int(s['kasPemerintah']),
      phase: s['phase'] as String,
      pendingTile: (s['pendingTile'] as num?)?.toInt(),
      lastDice: dice?.map((d) => (d as num).toInt()).toList(),
      aksiDipakai: s['aksiDipakai'] == true,
      result: s['result'] == null ? null : Map<String, dynamic>.from(s['result'] as Map),
    );
  }
}

class PlayerSecret {
  const PlayerSecret({required this.role, required this.mimpi});

  final String role;
  final String mimpi;

  bool get isBuzzer => role == 'buzzer';

  factory PlayerSecret.fromJson(Map<String, dynamic> j) =>
      PlayerSecret(role: j['role'] as String, mimpi: j['mimpi'] as String);
}

class GameEventRow {
  const GameEventRow({
    required this.id,
    required this.type,
    required this.actorId,
    required this.payload,
  });

  final int id;
  final String type;
  final String? actorId;
  final Map<String, dynamic> payload;

  factory GameEventRow.fromJson(Map<String, dynamic> j) => GameEventRow(
        id: _int(j['id']),
        type: j['type'] as String,
        actorId: j['actor_id'] as String?,
        payload: j['payload'] == null
            ? const {}
            : Map<String, dynamic>.from(j['payload'] as Map),
      );
}
