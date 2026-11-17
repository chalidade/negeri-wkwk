// "Tes sambungan": memeriksa apakah HP ini bisa main bareng lewat internet.
// 1. Tiap server penghubung dihubungi dan diukur waktu bolak-baliknya.
// 2. Dua pemain bayangan di HP ini saling berkirim pesan lewat server, persis seperti permainan sungguhan.
// Dimuat hanya saat tombolnya ditekan.

import { RELAY_URLS } from "./config.ts";
import { sambungMqtt } from "./mqtt.ts";
import { saluranInternet } from "./net.ts";

export interface BarisTes {
  nama: string;
  /** null selama masih diperiksa */
  ok: boolean | null;
  ket: string;
}

const BATAS_MS = 12_000;
const acak = () => Math.random().toString(36).slice(2, 10);

/** Hubungi satu server, lalu kirim pesan kecil ke diri sendiri lewat server itu. */
function tesServer(url: string): Promise<{ ok: boolean; ket: string }> {
  return new Promise((selesai) => {
    const mulai = performance.now();
    const topik = `nw1/tes${acak()}`;
    let kirim = 0;
    let beres = false;
    const tutup = (ok: boolean, ket: string) => {
      if (beres) return;
      beres = true;
      clearTimeout(batas);
      klien.tutup();
      selesai({ ok, ket });
    };
    const klien = sambungMqtt(url, {
      topik,
      onBuka: () => {
        kirim = performance.now();
        klien.terbit(topik, new TextEncoder().encode("tes"));
      },
      onPesan: () => tutup(true, `tersambung dalam ${Math.round(kirim - mulai)} ms, bolak-balik ${Math.round(performance.now() - kirim)} ms`),
      onTutup: () => undefined,
    });
    const batas = setTimeout(() => tutup(false, kirim ? "tersambung, tapi pesan tidak kembali" : "tidak bisa dihubungi dari jaringan ini"), BATAS_MS);
  });
}

/** Dua pemain bayangan saling kenal lalu bertukar pesan pribadi lewat server penghubung. */
async function tesDuaPemain(): Promise<{ ok: boolean; ket: string }> {
  const ruang = `tes-${acak()}${acak()}`;
  const [a, b] = await Promise.all([saluranInternet(ruang), saluranInternet(ruang)]);
  try {
    const mulai = performance.now();
    return await new Promise((selesai) => {
      let kirim = 0;
      const batas = setTimeout(() => selesai({ ok: false, ket: kirim ? "saling kenal, tapi pesan tidak sampai" : "dua pemain tidak saling menemukan" }), BATAS_MS);
      // A mengenal B: kirim pesan pribadi; B membalas; A menerima balasan = lancar dua arah
      a.onMasuk((idB) => {
        if (kirim) return;
        kirim = performance.now();
        a.kirim({ t: "tes", isi: "x".repeat(8000) }, idB);
      });
      b.onPesan((p, dari) => p.t === "tes" && b.kirim({ t: "balas" }, dari));
      a.onPesan((p) => {
        if (p.t !== "balas") return;
        clearTimeout(batas);
        selesai({ ok: true, ket: `saling kenal dalam ${Math.round(kirim - mulai)} ms, kirim dan balas ${Math.round(performance.now() - kirim)} ms` });
      });
    });
  } finally {
    a.tutup();
    b.tutup();
  }
}

/** Jalankan semua pemeriksaan; `lapor` dipanggil tiap ada hasil baru. */
export async function tesSambungan(lapor: (baris: BarisTes[]) => void): Promise<void> {
  const baris: BarisTes[] = [
    ...RELAY_URLS.map((url, i) => ({ nama: `Server penghubung ${i + 1} (${new URL(url).hostname})`, ok: null, ket: "memeriksa…" })),
    { nama: "Kirim-terima antar dua pemain", ok: null, ket: "memeriksa…" },
  ];
  lapor(baris);
  const isi = (i: number, h: { ok: boolean; ket: string }) => {
    baris[i] = { ...baris[i], ...h };
    lapor(baris);
  };
  await Promise.all([
    ...RELAY_URLS.map((url, i) => tesServer(url).then((h) => isi(i, h))),
    tesDuaPemain()
      .catch((e: unknown) => ({ ok: false, ket: e instanceof Error ? e.message : "gagal" }))
      .then((h) => isi(RELAY_URLS.length, h)),
  ]);
}
