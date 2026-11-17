// Klien MQTT 3.1.1 mini lewat WebSocket. Hanya yang dibutuhkan saluran relay:
// CONNECT, SUBSCRIBE satu topik, PUBLISH QoS 0, dan PING. Menyambung ulang sendiri.
// Sengaja ditulis sendiri (sekitar 150 baris) supaya tidak menambah pustaka ratusan KB.

export interface KlienMqtt {
  /** Terbitkan ke topik. `false` kalau sedang tidak tersambung (pesan dibuang). */
  terbit(topik: string, isi: Uint8Array): boolean;
  tersambung(): boolean;
  tutup(): void;
}

export interface OpsiMqtt {
  /** satu-satunya topik yang dilanggani */
  topik: string;
  onPesan(isi: Uint8Array): void;
  /** tersambung dan langganan aktif (dipanggil lagi tiap berhasil sambung ulang) */
  onBuka(): void;
  onTutup(): void;
}

const enc = new TextEncoder();
/** Detik. Broker memutus klien yang diam lebih dari 1,5 kali nilai ini. */
const KEEPALIVE = 45;

/** Teks berawalan panjang 2 byte, format baku MQTT. */
function teks(s: string): Uint8Array {
  const b = enc.encode(s);
  const o = new Uint8Array(2 + b.length);
  o[0] = b.length >> 8;
  o[1] = b.length & 255;
  o.set(b, 2);
  return o;
}

/** Satu paket MQTT: byte jenis, panjang sisa (1 sampai 4 byte), lalu isinya. */
function paket(jenis: number, ...bagian: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const n = bagian.reduce((a, b) => a + b.length, 0);
  const panjang: number[] = [];
  let x = n;
  do {
    let d = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) d |= 128;
    panjang.push(d);
  } while (x > 0);
  const o = new Uint8Array(1 + panjang.length + n);
  o[0] = jenis;
  o.set(panjang, 1);
  let at = 1 + panjang.length;
  for (const b of bagian) {
    o.set(b, at);
    at += b.length;
  }
  return o;
}

export function sambungMqtt(url: string, opsi: OpsiMqtt): KlienMqtt {
  let ws: WebSocket | null = null;
  let siap = false;
  let ditutup = false;
  let gagal = 0;
  let ulang: ReturnType<typeof setTimeout> | undefined;
  let detak: ReturnType<typeof setInterval> | undefined;
  let terakhirDengar = 0;
  let sisa = new Uint8Array(0);

  const putus = () => {
    clearInterval(detak);
    const tadiSiap = siap;
    siap = false;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* sudah tertutup */
      }
      ws = null;
    }
    if (tadiSiap) opsi.onTutup();
    if (ditutup) return;
    // coba lagi: 1, 2, 4, 8 detik, lalu tiap 10 detik, dengan sedikit acak supaya tidak serempak
    const jeda = Math.min(10_000, 1000 * 2 ** gagal) + Math.random() * 500;
    gagal += 1;
    ulang = setTimeout(sambung, jeda);
  };

  const tangani = (kepala: number, badan: Uint8Array) => {
    const jenis = kepala >> 4;
    if (jenis === 2) {
      // CONNACK: byte kedua 0 berarti diterima
      if (badan[1] !== 0) return putus();
      ws?.send(paket(0x82, Uint8Array.of(0, 1), teks(opsi.topik), Uint8Array.of(0)));
    } else if (jenis === 9) {
      // SUBACK: 0x80 berarti langganan ditolak
      if (badan[2] === 0x80) return putus();
      siap = true;
      gagal = 0;
      opsi.onBuka();
    } else if (jenis === 3) {
      // PUBLISH: nama topik, (id paket kalau QoS > 0), lalu isi
      const qos = (kepala >> 1) & 3;
      const mulai = 2 + ((badan[0] << 8) | badan[1]) + (qos ? 2 : 0);
      if (mulai <= badan.length) opsi.onPesan(badan.slice(mulai));
    }
    // PINGRESP dan lainnya: cukup dicatat sebagai tanda broker masih hidup
  };

  const terima = (data: ArrayBuffer) => {
    terakhirDengar = Date.now();
    const baru = new Uint8Array(data);
    const buf = new Uint8Array(sisa.length + baru.length);
    buf.set(sisa);
    buf.set(baru, sisa.length);
    let at = 0;
    // satu bingkai WebSocket bisa berisi beberapa paket, atau hanya sepotong paket
    for (;;) {
      if (buf.length - at < 2) break;
      let panjang = 0;
      let kali = 1;
      let i = at + 1;
      let lengkap = false;
      for (; i < buf.length && i < at + 5; i++) {
        panjang += (buf[i] & 127) * kali;
        kali *= 128;
        if (!(buf[i] & 128)) {
          lengkap = true;
          i++;
          break;
        }
      }
      if (!lengkap || buf.length - i < panjang) break;
      tangani(buf[at], buf.subarray(i, i + panjang));
      at = i + panjang;
    }
    sisa = buf.slice(at);
  };

  function sambung(): void {
    if (ditutup) return;
    sisa = new Uint8Array(0);
    let soket: WebSocket;
    try {
      soket = new WebSocket(url, "mqtt");
    } catch {
      return putus();
    }
    ws = soket;
    soket.binaryType = "arraybuffer";
    soket.onopen = () => {
      terakhirDengar = Date.now();
      // id klien acak, bersih dari sesi lama (clean session), tanpa nama pengguna
      const id = "nw" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
      soket.send(paket(0x10, teks("MQTT"), Uint8Array.of(4, 0x02, 0, KEEPALIVE), teks(id)));
      detak = setInterval(() => {
        // broker bisu terlalu lama: anggap sambungan mati dan mulai lagi
        if (Date.now() - terakhirDengar > KEEPALIVE * 1000) return putus();
        if (soket.readyState === WebSocket.OPEN) soket.send(Uint8Array.of(0xc0, 0));
      }, 15_000);
    };
    soket.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) terima(ev.data);
    };
    soket.onclose = putus;
    soket.onerror = putus;
  }
  sambung();

  return {
    terbit(topik, isi) {
      if (!siap || !ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(paket(0x30, teks(topik), isi));
      return true;
    },
    tersambung: () => siap,
    tutup() {
      ditutup = true;
      clearTimeout(ulang);
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(Uint8Array.of(0xe0, 0));
        } catch {
          /* tidak apa-apa */
        }
      }
      putus();
    },
  };
}
