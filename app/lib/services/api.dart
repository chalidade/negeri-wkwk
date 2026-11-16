import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/game_state.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.code, this.status});

  final String message;
  final String? code;
  final int? status;

  /// State di server sudah berubah; tinggal tunggu realtime atau muat ulang.
  bool get isStale => code == 'state_basi';

  @override
  String toString() => message;
}

/// Pemanggil Edge Functions + query baca. Semua penulisan lewat server.
class GameApi {
  GameApi(this._client);

  final SupabaseClient _client;

  static GameApi get instance => GameApi(Supabase.instance.client);

  String get userId => _client.auth.currentUser!.id;

  Future<Map<String, dynamic>> _call(String fn, Map<String, dynamic> body) async {
    try {
      final res = await _client.functions.invoke(fn, body: body);
      final data = res.data;
      if (data is Map) return Map<String, dynamic>.from(data);
      return <String, dynamic>{};
    } on FunctionException catch (e) {
      final details = e.details;
      var message = 'Ada yang error, coba lagi ya.';
      String? code;
      if (details is Map) {
        if (details['message'] is String) message = details['message'] as String;
        if (details['error'] is String) code = details['error'] as String;
      }
      throw ApiException(message, code: code, status: e.status);
    }
  }

  Future<({String roomId, String code})> createRoom({
    required String mode,
    String? profession,
  }) async {
    final res = await _call('create-room', {
      'mode': mode,
      if (profession != null) 'profession': profession,
    });
    return (roomId: res['roomId'] as String, code: res['code'] as String);
  }

  Future<String> joinRoom({required String code, String? profession}) async {
    final res = await _call('join-room', {
      'code': code,
      if (profession != null) 'profession': profession,
    });
    return res['roomId'] as String;
  }

  Future<void> startGame(String roomId) => _call('start-game', {'roomId': roomId});

  Future<void> sendAction(String roomId, int version, Map<String, dynamic> action) =>
      _call('game-action', {'roomId': roomId, 'version': version, 'action': action});

  /// Wajib ada untuk rilis: Apple & Google minta fitur hapus akun di dalam aplikasi.
  Future<void> deleteAccount() => _call('delete-account', {});

  // ---------------------------------------------------------------- baca

  Stream<List<Map<String, dynamic>>> watchMembers(String roomId) => _client
      .from('room_members')
      .stream(primaryKey: ['room_id', 'user_id'])
      .eq('room_id', roomId)
      .order('seat', ascending: true);

  Future<Map<String, dynamic>> fetchRoom(String roomId) => _client
      .from('rooms')
      .select('id, code, host_id, mode, max_players, status')
      .eq('id', roomId)
      .single();

  Stream<GameState?> watchGame(String roomId) => _client
      .from('game_states')
      .stream(primaryKey: ['room_id'])
      .eq('room_id', roomId)
      .map((rows) => rows.isEmpty ? null : GameState.fromRow(rows.first));

  Stream<List<GameEventRow>> watchEvents(String roomId) => _client
      .from('game_events')
      .stream(primaryKey: ['id'])
      .eq('room_id', roomId)
      .order('id', ascending: false)
      .limit(40)
      .map((rows) => rows.map(GameEventRow.fromJson).toList());

  Future<PlayerSecret?> mySecret(String roomId) async {
    final row = await _client
        .from('player_secrets')
        .select('role, mimpi')
        .eq('room_id', roomId)
        .maybeSingle();
    return row == null ? null : PlayerSecret.fromJson(row);
  }
}
