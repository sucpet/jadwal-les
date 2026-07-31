# Feature Backlog — jadwal-les

Catatan ide fitur yang belum dikerjakan. Diperbarui seiring diskusi.
Status: 🟢 siap dikerjakan · 💤 ditunda · ❌ tidak jadi

---

## 🟢 Backlog aktif

### 1. Halaman Tagihan
Satu halaman berisi **semua murid yang masih menunggak** (billed − dibayar).

- **Isi:** daftar murid dengan tunggakan, nominal kurangnya, diurutkan dari terbesar.
- **Aksi:** tombol **WA tagih** langsung di tiap baris (pakai `waLink` + template `wa.billMsg` yang sudah ada).
- **Flow:** buka halaman Tagihan → lihat siapa yang nunggak → klik WA tagih → WhatsApp terbuka dengan pesan terisi → kirim manual.
- **Prasyarat:** tidak ada yang baru (data payments/packages + `phone` sudah ada).
- **Effort:** kecil–sedang (1 halaman baru + entri nav).
- **Nyambung dengan:** fitur billing WA yang sudah dibuat (tombol "Tagih via WA" di panel pembayaran murid).

### 2. Status kehadiran per sesi
Perkaya status sesi selain `selesai`/`terjadwal`.

- **Opsi baru saat menandai sesi:** Hadir / Izin / Sakit / Alfa.
- **Manfaat:** rekap kehadiran, deteksi murid yang sering bolos, bisa memengaruhi logika finance (mis. alfa tetap terhitung/ tidak — perlu diputuskan).
- **Prasyarat:** kolom baru di tabel `sessions` (mis. `attendance`), migration kecil.
- **Effort:** sedang (ubah alur "tandai selesai" + tampilan + rekap).
- **Perlu keputusan:** apakah Izin/Sakit/Alfa memengaruhi honor/pendapatan?

### 3. Rekap bulanan ke gambar/PDF
Export rekap keuangan/jam per laoshi untuk dikirim ke lembaga/orang tua.

- **Isi:** render rekap bulan berjalan (Finance/Finance Detail) jadi gambar (PNG) atau PDF.
- **Flow:** buka rekap → tombol "Export" → unduh/bagikan.
- **Prasyarat:** library render (mis. html-to-image / canvas) — perlu dipastikan bisa self-contained (PWA offline).
- **Effort:** sedang.

---

## ❌ Tidak jadi (sudah dipertimbangkan, di-skip)

- **Rekap per murid** (kartu ringkasan total sesi/dibayar/tunggakan) — tidak diperlukan.
- **"Selesaikan semua sesi hari ini"** (bulk complete) — tidak diperlukan.
- **Grafik di Dashboard** (tren pendapatan / jam per laoshi) — tidak diperlukan.

---

## ✅ Sudah ada (konteks, jangan diusulkan lagi)

- Pengingat paket hampir/ sudah habis (Dashboard alerts).
- Deteksi bentrok jadwal (saat tambah & quick-reschedule).
- Reminder les via WhatsApp (semi-auto, tombol di kartu sesi hari ini).
- Tombol "Tagih via WA" di panel pembayaran murid.
- Activity log, restore dari backup, i18n ID/EN, dark mode, force logout.
