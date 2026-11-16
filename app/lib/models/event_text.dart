import 'board.dart';
import 'game_state.dart';

/// Ubah event dari server jadi kalimat untuk log permainan.
/// Mengembalikan null untuk event yang tidak perlu ditampilkan.
String? describeEvent(GameEventRow e, GameState? game, Board board) {
  String nameOf(String? id) {
    if (id == null) return 'Seseorang';
    if (id == governmentId) return 'Pemerintah';
    return game?.players[id]?.name ?? 'Pemain';
  }

  String tileName(Object? idx) {
    final i = (idx as num?)?.toInt();
    if (i == null || i < 0 || i >= board.tiles.length) return 'petak';
    return board.tiles[i].name;
  }

  int n(String key) => (e.payload[key] as num?)?.toInt() ?? 0;

  final who = nameOf(e.actorId);
  final p = e.payload;

  switch (e.type) {
    case 'game_mulai':
      return '🎬 Permainan dimulai. Semangat, Warga!';
    case 'dadu':
      final d = (p['dadu'] as List?)?.map((x) => (x as num).toInt()).toList() ?? [0, 0];
      final kembar = d.length == 2 && d[0] == d[1] ? ' (kembar!)' : '';
      return '🎲 $who melempar ${d.join(' + ')}$kembar';
    case 'gerak':
      return null; // posisi sudah terlihat di papan
    case 'lewat_gajian':
      return '💰 $who lewat Gajian, dapat bonus ₵${n('bonus')}';
    case 'gajian':
      return '💵 $who gajian ₵${n('jumlah')}';
    case 'gaji_berhenti':
      return '😢 $who kena PHK, gaji berhenti';
    case 'tawaran_beli':
      return '🏷️ $who mampir di ${tileName(p['tile'])} (₵${n('harga')})';
    case 'beli':
      return '🏪 $who membuka usaha di ${tileName(p['tile'])}';
    case 'lewati_beli':
      return '🚶 $who nggak jadi beli ${tileName(p['tile'])}';
    case 'bayar_sewa':
      return '🤝 $who bayar sewa ₵${n('jumlah')} ke ${nameOf(p['ke'] as String?)}';
    case 'bangga_produk_lokal':
      return '🇮🇩 Bangga Produk Lokal! Bonus ₵${n('bonus')} buat penyewa dan pemilik';
    case 'setor_ke_pemerintah':
      return '🪑 $who setor ₵${n('jumlah')} ke ${tileName(p['tile'])}';
    case 'pajak':
      return '🧾 $who bayar ${tileName(p['tile'])} ₵${n('jumlah')}';
    case 'kartu':
      final dek = p['dek'] == 'grup_wa' ? '💬 Grup WA' : '🎲 Nasib WNI';
      return '$dek • $who: ${p['judul']} — ${p['teks']}';
    case 'kena_tilang':
      final alasan = switch (p['alasan']) {
        'ott' => 'kena OTT',
        'diciduk' => 'diciduk',
        'kebut_kebutan' => '3x dadu kembar',
        _ => 'ditilang',
      };
      return '🚓 $who masuk Kena Tilang ($alasan)';
    case 'masih_ditilang':
      return '⏳ $who masih ditilang (${n('sisa')} giliran lagi)';
    case 'bebas_tilang':
      return '🔓 $who bebas dari tilang';
    case 'bayar_denda':
      return '🧾 $who bayar denda tilang ₵${n('jumlah')}';
    case 'ott':
      return '🚨 OTT! $who kena denda ₵${n('denda')}';
    case 'bencana':
      final bantuan = n('bantuanLumbung');
      final extra = bantuan > 0 ? ', Lumbung bantu ₵$bantuan' : '';
      return '🌊 Bencana! Usaha grup ${p['grup']} libur tagih sewa$extra';
    case 'sewa_libur_bencana':
      return '🌊 Sewa ${tileName(p['tile'])} libur karena bencana';
    case 'tabungan_menyelamatkan':
      return '🛟 Tabungan Darurat $who menyelamatkan ₵${n('jumlah')}';
    case 'bangkrut':
      return '💀 $who BANGKRUT';
    case 'meter_gerakan':
      final dari = n('dari');
      final ke = n('ke');
      if (dari == ke) return null;
      final arah = ke > dari ? '📈' : '📉';
      return '$arah Meter Gerakan $dari → $ke';
    case 'upgrade':
      final lvl = n('level').clamp(0, levelLabels.length - 1);
      return '⬆️ $who upgrade ${tileName(p['tile'])} jadi ${levelLabels[lvl]}';
    case 'setor_tabungan':
      return '🐷 $who nabung ₵${n('jumlah')}';
    case 'donasi_lumbung':
      return '🌾 $who donasi ₵${n('jumlah')} ke Lumbung Bersama';
    case 'petisi':
      return '✍️ $who memulai petisi online (+${n('gerakan')})';
    case 'liputan_media':
      return '📰 $who mendanai liputan media independen (+${n('gerakan')})';
    case 'giliran':
      return null;
    case 'biaya_hidup':
      return '🍚 Biaya hidup ronde ini ₵${n('jumlah')} per orang';
    case 'inflasi_naik':
      return '📈 Meteran Inflasi naik ke tingkat ${n('tingkat')}';
    case 'ronde_baru':
      return '🗓️ Ronde ${n('ronde')} dimulai';
    case 'musim_kampanye':
      return '📣 Musim Kampanye! Pemerintah tiba-tiba bagi-bagi bansos';
    case 'kebijakan':
      return '🏛️ Kebijakan: ${p['judul']} — ${p['teks']}';
    case 'demo_akbar':
      return '✊ DEMO AKBAR! Kesabaran rakyat habis';
    case 'digusur':
      return '🚧 Usaha $who di ${tileName(p['tile'])} digusur proyek';
    case 'lewati_giliran':
      return '🙈 $who malu ditanya "kapan nikah", lewati giliran';
    case 'game_selesai':
      return '🏁 ${resultText(p)}';
    default:
      return null;
  }
}

String resultText(Map<String, dynamic> result) {
  switch (result['kind']) {
    case 'rakyat_menang':
      return 'REFORMASI BERHASIL! Rakyat menang!';
    case 'rakyat_kalah':
      return result['reason'] == 'waktu_habis'
          ? 'Waktu habis. Rezim masih berkuasa…'
          : 'Dua warga bangkrut. Rakyat kalah…';
    case 'juragan_menang':
      return 'Ada juragan baru di Negeri Wkwk!';
    default:
      return 'Permainan selesai.';
  }
}
