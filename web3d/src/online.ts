// Layar "Main bareng teman" tanpa server: bikin room (lewat internet atau tanpa internet),
// gabung pakai kode atau link, daftar room publik, ruang tunggu, dan undangan lewat QR.
import QRCode from "qrcode";
import jsQR from "jsqr";
import { h, modal, toast } from "./dom.ts";
import type { Driver } from "./driver.ts";
import { WEB_URL, diAplikasi } from "./config.ts";
import { ApiError } from "./errors.ts";
import { ava, ic } from "./icons.ts";
import { saluranInternet, tamuLokal, tuanLokal, type Saluran, type TuanLokal } from "./net.ts";
import {
  adaRoomTuan,
  bukaTamu,
  bukaTuan,
  pantauRoom,
  simpananTamu,
  type Iklan,
  type InfoLobi,
  type Jenis,
  type Tamu,
  type Tuan,
} from "./p2p.ts";
import { sfx } from "./sfx.ts";
import { BABAK, PROFESSION_LABEL, type Profession } from "./shared.ts";

export interface KonteksOnline {
  nama: string;
  profesi: Profession;
  babak: number;
  show(view: HTMLElement): void;
  setCleanup(fn: (() => void) | null): void;
  runGame(driver: Driver, opsi: { onExit: () => void; menu?: { label: string; ikon: string; aksi: () => void }[] }): void;
  home(): void;
}

let K: KonteksOnline;
const pesanGalat = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Ada yang error, coba lagi.");
const kembali = (aksi: () => void) => h("button", { class: "icon", "aria-label": "Kembali", onclick: aksi }, ic("kiri"));

/** Link undangan yang bisa dikirim lewat WA: membuka game dan langsung bergabung. */
const linkRoom = (kode: string) => `${diAplikasi() ? WEB_URL : location.origin}/?gabung=${kode}`;

/** Salin teks: di aplikasi Android pakai plugin, di peramban pakai clipboard biasa. */
export async function salin(teks: string): Promise<void> {
  if (diAplikasi()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: teks });
  } else await navigator.clipboard?.writeText(teks);
}

async function bagikan(kode: string): Promise<void> {
  const teks = `Main Negeri Wkwk bareng aku! Kode room: ${kode}`;
  const url = linkRoom(kode);
  try {
    if (diAplikasi()) {
      const { Share } = await import("@capacitor/share");
      return void (await Share.share({ title: "Negeri Wkwk", text: teks, url, dialogTitle: "Ajak teman" }));
    }
    if (navigator.share) return await navigator.share({ title: "Negeri Wkwk", text: teks, url });
  } catch {
    return; // dibatalkan
  }
  await salin(`${teks}\n${url}`).catch(() => undefined);
  toast("Link room disalin. Tempel di WA.");
}

// ------------------------------------------------------------------ layar utama

export function layarBareng(ctx: KonteksOnline, kodeAwal?: string): void {
  K = ctx;
  if (kodeAwal) return void gabungInternet(kodeAwal.toUpperCase());
  let jenis: Jenis = "internet";
  let publik = false;
  const segI = h("button", { onclick: () => pilihJenis("internet") }, "Lewat internet");
  const segL = h("button", { onclick: () => pilihJenis("lokal") }, "Tanpa internet");
  const publikBtn = h("button", { class: "saklar", onclick: () => setPublik(!publik) });
  const publikBaris = h("div", { class: "baris-saklar" }, h("span", {}, h("b", {}, "Tampilkan di daftar room"), h("small", {}, "Orang lain bisa ikut tanpa kode")), publikBtn);
  const hint = h("div", { class: "muted" });
  const setPublik = (v: boolean) => {
    publik = v;
    publikBtn.classList.toggle("on", v);
    publikBtn.setAttribute("aria-pressed", String(v));
  };
  const pilihJenis = (j: Jenis) => {
    jenis = j;
    segI.className = j === "internet" ? "on" : "";
    segL.className = j === "lokal" ? "on" : "";
    publikBaris.style.display = j === "internet" ? "" : "none";
    hint.textContent =
      j === "internet"
        ? "Teman masuk pakai kode atau link. HP-mu jadi tuan rumah, jadi jangan keluar dari game selama main."
        : "Tanpa internet: semua HP nyambung ke Wi-Fi atau hotspot yang sama, lalu tiap teman pindai kode QR dari HP-mu.";
  };
  pilihJenis("internet");
  setPublik(false);

  const kode = h("input", { placeholder: "KODE", maxLength: 6, style: "text-transform:uppercase;letter-spacing:.15em", "aria-label": "Kode room" });
  const daftar = h("div", { class: "col", style: "gap:7px" }, h("div", { class: "muted" }, "Mencari room terbuka…"));

  const lanjutan: HTMLElement[] = [];
  if (adaRoomTuan()) lanjutan.push(h("button", { class: "btn big green block", onclick: () => lanjutTuan() }, ic("main"), "Lanjutkan room kamu"));
  const tamu = simpananTamu();
  if (tamu) lanjutan.push(h("button", { class: "btn green block", onclick: () => gabungInternet(tamu.kode) }, ic("main"), `Masuk lagi ke room ${tamu.kode}`));

  K.show(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "col" },
        h("div", { class: "row" }, kembali(() => K.home()), h("div", { class: "h1" }, "Main bareng teman")),
        ...lanjutan,
        h(
          "div",
          { class: "panel col" },
          h("div", { class: "sheet-title" }, ic("tambah"), "Bikin room"),
          h("div", { class: "seg" }, segI, segL),
          hint,
          publikBaris,
          h("div", { class: "muted small" }, `Lawan: babak ${ctx.babak}, ${BABAK[ctx.babak - 1].nama}. Ganti babak di beranda.`),
          h("button", { class: "btn red block", onclick: () => bikin(jenis, publik) }, "Bikin room"),
        ),
        h(
          "div",
          { class: "panel col" },
          h("div", { class: "sheet-title" }, ic("warga"), "Gabung"),
          h(
            "div",
            { class: "row", style: "flex-wrap:nowrap" },
            kode,
            h("button", {
              class: "btn blue",
              onclick: () => {
                const c = kode.value.trim().toUpperCase();
                if (c.length !== 6) return toast("Kode room 6 huruf.");
                gabungInternet(c);
              },
            }, "Gabung"),
          ),
          h("button", { class: "btn grey block", onclick: () => gabungLokal() }, ic("kartu"), "Pindai QR tuan rumah (tanpa internet)"),
        ),
        h("div", { class: "panel col" }, h("div", { class: "sheet-title" }, ic("suara"), "Room terbuka"), daftar),
      ),
    ),
  );

  let berhenti: (() => void) | null = null;
  let mati = false;
  K.setCleanup(() => {
    mati = true;
    berhenti?.();
  });
  void pantauRoom((list: Iklan[]) => {
    daftar.replaceChildren(
      ...(list.length === 0
        ? [h("div", { class: "muted" }, "Belum ada room terbuka. Bikin sendiri, atau main sama bot dulu.")]
        : list.map((r) =>
            h(
              "button",
              { class: "arow", onclick: () => gabungInternet(r.kode) },
              h("span", { class: "a-icon" }, ic("warga")),
              h("span", { class: "a-main" }, h("b", {}, `Room ${r.tuan}`), h("small", {}, `Babak ${r.babak}, ${r.isi} dari ${r.maks} warga`)),
              h("span", { class: "a-label" }, "masuk"),
            ),
          )),
    );
  })
    .then((stop) => (mati ? stop() : (berhenti = stop)))
    .catch(() => daftar.replaceChildren(h("div", { class: "muted" }, "Daftar room tidak bisa dimuat. Masih bisa gabung pakai kode.")));
}

// ------------------------------------------------------------------ tuan rumah

async function bikin(jenis: Jenis, publik: boolean): Promise<void> {
  sfx.click();
  try {
    const kode = (await import("./p2p.ts")).kodeBaru();
    const saluran: Saluran | TuanLokal = jenis === "internet" ? await saluranInternet(`room-${kode}`) : tuanLokal();
    const tuan = bukaTuan(saluran, { jenis, publik, babak: K.babak, nama: K.nama, profesi: K.profesi, kode });
    lobiTuan(tuan, saluran);
  } catch (e) {
    toast(pesanGalat(e));
  }
}

async function lanjutTuan(): Promise<void> {
  try {
    const raw = JSON.parse(localStorage.getItem("wkwk.tuan.v1") ?? "null") as { info: InfoLobi } | null;
    if (!raw) return;
    const { kode, jenis } = raw.info;
    const saluran = jenis === "internet" ? await saluranInternet(`room-${kode}`) : tuanLokal();
    const tuan = bukaTuan(saluran, { jenis, publik: raw.info.publik, babak: raw.info.babak, nama: K.nama, profesi: K.profesi, kode, lanjut: true });
    const d = tuan.driver();
    if (d) mainSebagaiTuan(tuan, saluran, d);
    else lobiTuan(tuan, saluran);
  } catch (e) {
    toast(pesanGalat(e));
  }
}

function mainSebagaiTuan(tuan: Tuan, saluran: Saluran | TuanLokal, d: Driver): void {
  const lokal = tuan.info().jenis === "lokal";
  K.runGame(d, {
    onExit: () => {
      tuan.bubar(); // simpanan tetap ada: bisa dilanjutkan dari "Main bareng teman"
      K.home();
    },
    menu: lokal ? [{ label: "Sambungkan teman (QR)", ikon: "kartu", aksi: () => undangQR(saluran as TuanLokal) }] : [],
  });
}

function lobiTuan(tuan: Tuan, saluran: Saluran | TuanLokal): void {
  const info = tuan.info();
  const lokal = info.jenis === "lokal";
  const list = h("div", { class: "col", style: "gap:7px" });
  const hitung = h("label", {});
  const mulai = h("button", { class: "btn big red block" }, "Mulai permainan");
  const tambahBot = h("button", { class: "btn grey", style: "flex:1", onclick: () => tuan.tambahBot() }, ic("robot"), "Tambah bot");
  const publikBtn = h("button", { class: "saklar", onclick: () => tuan.setPublik(!tuan.info().publik) });
  let berjalan = false;

  const lukis = () => {
    const i = tuan.info();
    hitung.textContent = `Warga (${i.anggota.length}/${i.maks})`;
    publikBtn.classList.toggle("on", i.publik);
    list.replaceChildren(
      ...i.anggota.map((a, seat) =>
        h(
          "div",
          { class: "member" },
          ava(a.profesi, seat),
          h(
            "div",
            { style: "flex:1;min-width:0" },
            h("b", {}, a.bot ? ic("robot") : null, a.bot ? ` ${a.nama}` : a.nama),
            h("div", { class: "muted small" }, seat === 0 ? "Tuan rumah" : a.bot ? "Bot" : a.ada === false ? "Terputus" : a.profesi ? PROFESSION_LABEL[a.profesi] : "Profesi acak"),
          ),
          seat > 0 ? h("button", { class: "icon", "aria-label": `Keluarkan ${a.nama}`, onclick: () => tuan.hapus(a.id) }, ic("silang")) : null,
        ),
      ),
    );
    mulai.disabled = i.anggota.length < 2;
    mulai.textContent = i.anggota.length < 2 ? "Tunggu teman, atau tambah bot" : "Mulai permainan";
    tambahBot.style.display = i.anggota.length >= i.maks ? "none" : "";
  };
  tuan.onUbah(lukis);
  mulai.onclick = () => {
    try {
      berjalan = true;
      mainSebagaiTuan(tuan, saluran, tuan.mulai());
    } catch (e) {
      berjalan = false;
      toast(pesanGalat(e));
    }
  };

  K.show(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "col" },
        h("div", { class: "row" }, kembali(() => {
          tuan.bubar();
          localStorage.removeItem("wkwk.tuan.v1");
          layarBareng(K);
        }), h("div", { class: "h1" }, "Ruang tunggu")),
        lokal
          ? h(
              "div",
              { class: "panel col center" },
              h("div", { class: "sheet-title" }, ic("kartu"), "Tanpa internet"),
              h("div", { class: "muted" }, "Pastikan semua HP tersambung ke Wi-Fi atau hotspot yang sama. Undang teman satu per satu: dia memindai QR dari HP-mu, lalu kamu memindai QR jawaban dari HP-nya."),
              h("button", { class: "btn blue block", onclick: () => undangQR(saluran as TuanLokal) }, ic("tambah"), "Undang teman"),
            )
          : h(
              "div",
              { class: "panel col center" },
              h("label", {}, "Kode room"),
              h("div", { class: "code" }, info.kode),
              h("button", { class: "btn blue block", onclick: () => void bagikan(info.kode) }, ic("salin"), "Bagikan link ke teman"),
              h("div", { class: "baris-saklar" }, h("span", {}, h("b", {}, "Tampilkan di daftar room"), h("small", {}, "Orang lain bisa ikut tanpa kode")), publikBtn),
            ),
        hitung,
        list,
        h("div", { class: "row" }, tambahBot),
        mulai,
        h("div", { class: "catatan small" }, "HP-mu jadi tuan rumah: permainan berjalan dan tersimpan di sini. Jangan keluar dari game selama main."),
      ),
    ),
  );
  lukis();
  K.setCleanup(() => {
    if (!berjalan) tuan.bubar();
  });
}

// ------------------------------------------------------------------ tamu

async function gabungInternet(kode: string): Promise<void> {
  sfx.click();
  try {
    const saluran = await saluranInternet(`room-${kode}`);
    lobiTamu(bukaTamu(saluran, { nama: K.nama, profesi: K.profesi, kode, jenis: "internet" }), kode);
  } catch (e) {
    toast(pesanGalat(e));
  }
}

function lobiTamu(tamu: Tamu, kode: string): void {
  const status = h("div", { class: "muted" });
  const list = h("div", { class: "col", style: "gap:7px" });
  let berjalan = false;
  // Tidak ketemu tuan rumah dalam beberapa detik: kasih tahu, tapi tetap menunggu.
  const telat = setTimeout(() => {
    if (!tamu.tersambung()) status.textContent = "Belum ketemu tuan rumah. Cek kodenya, dan pastikan HP tuan rumah masih membuka game.";
  }, 9000);
  const lukis = () => {
    const i = tamu.info();
    status.textContent = !tamu.tersambung()
      ? i
        ? "Sambungan ke tuan rumah putus. Menyambung ulang…"
        : "Menghubungi tuan rumah…"
      : i?.mulai
        ? "Permainan sudah berjalan. Memuat…"
        : "Tersambung. Menunggu tuan rumah memulai.";
    list.replaceChildren(
      ...(i?.anggota ?? []).map((a, seat) =>
        h(
          "div",
          { class: "member" },
          ava(a.profesi, seat),
          h("div", { style: "flex:1" }, h("b", {}, a.nama), h("div", { class: "muted small" }, seat === 0 ? "Tuan rumah" : a.bot ? "Bot" : a.profesi ? PROFESSION_LABEL[a.profesi] : "Profesi acak")),
        ),
      ),
    );
  };
  tamu.onUbah(lukis);
  tamu.onTolak((alasan) => {
    toast(alasan);
    berjalan = true;
    tamu.keluar();
    layarBareng(K);
  });
  tamu.onMulai((driver) => {
    berjalan = true;
    clearTimeout(telat);
    K.runGame(driver, {
      onExit: () => {
        // simpanannya tetap ada: bisa masuk lagi dari "Main bareng teman"
        K.home();
      },
    });
  });
  K.show(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "col" },
        h("div", { class: "row" }, kembali(() => {
          tamu.keluar();
          layarBareng(K);
        }), h("div", { class: "h1" }, "Ruang tunggu")),
        h("div", { class: "panel col center" }, h("label", {}, "Room"), h("div", { class: "code" }, kode), status),
        list,
      ),
    ),
  );
  lukis();
  K.setCleanup(() => {
    clearTimeout(telat);
    if (!berjalan) tamu.keluar();
  });
}

// ------------------------------------------------------------------ QR tanpa internet

async function qrCanvas(teks: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  await QRCode.toCanvas(c, teks, { errorCorrectionLevel: "L", margin: 2, width: 280, color: { dark: "#1b2440", light: "#ffffff" } });
  c.className = "qr";
  return c;
}

/**
 * Pemindai QR pakai kamera (jsQR), dengan kolom tempel sebagai cadangan
 * kalau kamera tidak diizinkan atau tidak tersedia.
 */
function pindai(judul: string, petunjuk: string): Promise<string | null> {
  return new Promise((selesai) => {
    let aliran: MediaStream | null = null;
    let raf = 0;
    let beres = false;
    const video = h("video", { class: "kamera", playsInline: true, muted: true });
    const kanvas = document.createElement("canvas");
    const tempel = h("textarea", { class: "tempel", placeholder: "Atau tempel kode di sini", rows: 3 });
    const akhiri = (hasil: string | null) => {
      if (beres) return;
      beres = true;
      cancelAnimationFrame(raf);
      aliran?.getTracks().forEach((t) => t.stop());
      tutup();
      selesai(hasil);
    };
    const tutup = modal(
      h(
        "div",
        { class: "sheet col" },
        h("div", { class: "sheet-title" }, ic("kartu"), judul),
        h("div", { class: "muted" }, petunjuk),
        video,
        tempel,
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn grey", style: "flex:1", onclick: () => akhiri(null) }, "Batal"),
          h("button", { class: "btn", style: "flex:1", onclick: () => tempel.value.trim() && akhiri(tempel.value.trim()) }, "Pakai kode"),
        ),
      ),
      () => akhiri(null),
    );
    const baca = () => {
      if (beres) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        kanvas.width = video.videoWidth;
        kanvas.height = video.videoHeight;
        const c2 = kanvas.getContext("2d", { willReadFrequently: true })!;
        c2.drawImage(video, 0, 0);
        const img = c2.getImageData(0, 0, kanvas.width, kanvas.height);
        const kode = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (kode?.data.startsWith("WK1")) {
          sfx.coin();
          return akhiri(kode.data);
        }
      }
      raf = requestAnimationFrame(baca);
    };
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (beres) return s.getTracks().forEach((t) => t.stop());
        aliran = s;
        video.srcObject = s;
        void video.play();
        baca();
      })
      .catch(() => {
        video.style.display = "none";
        toast("Kamera tidak bisa dibuka. Tempel kodenya saja.");
      });
  });
}

/** Tuan rumah mengundang satu teman: tampilkan QR undangan, lalu pindai QR jawabannya. */
async function undangQR(sal: TuanLokal): Promise<void> {
  let undangan;
  try {
    undangan = await sal.undang();
  } catch (e) {
    return toast(pesanGalat(e));
  }
  const kanvas = await qrCanvas(undangan.kode);
  const tutup = modal(
    h(
      "div",
      { class: "sheet col center" },
      h("div", { class: "sheet-title" }, ic("kartu"), "Undang teman"),
      h("div", { class: "muted" }, "1. Teman buka Negeri Wkwk, pilih Main bareng teman, lalu Pindai QR tuan rumah."),
      kanvas,
      h("button", { class: "btn grey small", onclick: () => void salin(undangan.kode).then(() => toast("Kode undangan disalin.")) }, ic("salin"), "Salin kode"),
      h("div", { class: "muted" }, "2. Setelah dia memunculkan QR jawaban, pindai dari HP-mu."),
      h("button", {
        class: "btn blue block",
        onclick: async () => {
          const jawaban = await pindai("Pindai QR jawaban", "Arahkan kamera ke QR jawaban di HP teman.");
          if (!jawaban) return;
          try {
            await undangan.terima(jawaban);
            tutup();
            toast("Menyambungkan…");
          } catch (e) {
            toast(pesanGalat(e));
          }
        },
      }, ic("kartu"), "Pindai jawaban"),
    ),
    () => undefined,
  );
}

/** Tamu tanpa internet: pindai undangan, tunjukkan QR jawaban, lalu masuk ruang tunggu. */
async function gabungLokal(): Promise<void> {
  const undangan = await pindai("Pindai QR tuan rumah", "Minta tuan rumah menekan Undang teman, lalu arahkan kamera ke QR di HP-nya.");
  if (!undangan) return;
  try {
    const { jawaban, saluran } = await tamuLokal(undangan);
    const tamu = bukaTamu(saluran, { nama: K.nama, profesi: K.profesi, kode: "", jenis: "lokal" });
    const kanvas = await qrCanvas(jawaban);
    const tutup = modal(
      h(
        "div",
        { class: "sheet col center" },
        h("div", { class: "sheet-title" }, ic("kartu"), "Tunjukkan ke tuan rumah"),
        h("div", { class: "muted" }, "Tuan rumah menekan Pindai jawaban dan memindai QR ini. Layar ini tertutup sendiri begitu tersambung."),
        kanvas,
        h("button", { class: "btn grey small", onclick: () => void salin(jawaban).then(() => toast("Kode jawaban disalin.")) }, ic("salin"), "Salin kode"),
        h("button", { class: "btn grey block", onclick: () => (tutup(), tamu.keluar()) }, "Batal"),
      ),
      () => undefined,
      false,
    );
    let pindah = false;
    tamu.onUbah(() => {
      const i = tamu.info();
      if (!i || pindah) return;
      pindah = true;
      tutup();
      lobiTamu(tamu, i.kode);
    });
  } catch (e) {
    toast(pesanGalat(e));
  }
}
