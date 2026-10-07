# Future Features — Jadwal Les

Berdasarkan analisis codebase + riset dari repo publik:
- [AzimKrishna/Tuition-Management-System](https://github.com/AzimKrishna/Tuition-Management-System)
- [govind978/Tuition-Notes-of-Student](https://github.com/govind978/Tuition-Notes-of-Student)
- TutorBird, LearnSpeed, Trakist (produk SaaS, open inspection)

---

## ✅ Sudah Selesai

- Deteksi konflik jadwal (warning saat guru double-book)
- Warning libur nasional 2026
- Flag murid berisiko churn (tidak ada sesi ≥21 hari)
- Search murid di halaman Murid
- Panel "7 hari ke depan" di Dashboard dengan paging
- Perubahan harga terjadwal untuk murid postpaid (set harga baru + tanggal berlaku, auto-promote saat tanggal lewat)
- Reschedule cepat satu sesi: tombol +1 minggu (dengan konfirmasi), mini-popover tanggal/jam, dan drag & drop di grid desktop
- Log aktivitas perubahan sesi (tambah / reschedule / hapus) di halaman terpisah
- Pilihan bahasa Indonesia / English (i18n penuh semua halaman, default English)
- Murid "dibayar lembaga": pendapatan diakui saat pembayaran dicatat (payment log per murid), bukan otomatis per bulan
- Perubahan honor guru terjadwal (mirror perubahan harga sesi murid) + honor snapshot per sesi
- Honor guru untuk murid dibayar lembaga diakui di bulan pembayaran pertama (Opsi A)
- Log Aktivitas mencakup semua CRUD (laoshi, murid, paket, sesi, worksheet, pembayaran, honor) + konfirmasi hapus paket diperkuat
- Non-aktifkan (arsip) murid & laoshi: histori/keuangan/honor tetap, hanya sesi terjadwal mendatang dihapus. Hapus tetap permanen (cascade eksplisit, tanpa yatim)

---

## 📝 Catatan & Progress Murid

- **Catatan per sesi** — field `notes` di `LessonSession` sudah ada di model tapi belum ada UI-nya. Tambahkan area tulis catatan saat menandai sesi selesai: materi, performa, PR diberikan. *(govind978, TutorBird, LearnSpeed)*
- **Homework tracking** — catat PR yang diberikan tiap sesi dan apakah sudah dikerjakan di sesi berikutnya. *(govind978, TutorBird)*
- **Target belajar per murid** — field di profil murid terpisah dari `notes` umum: "Persiapan UTBK Matematika", "Fokus reading IELTS". Agar tujuan jangka panjang tidak tenggelam di catatan operasional. *(LearnSpeed, TutorBird)*
- **Catatan perkembangan** — log progress per sesi, topik yang dipelajari, nilai/skor jika ada. *(LearnSpeed)*

---

## 📅 Jadwal & Kehadiran

- **Sesi make-up / pengganti** — saat sesi dibatalkan, tandai "perlu make-up". Saat sesi pengganti dijadwalkan, link ke sesi aslinya. Dashboard tampilkan berapa make-up masih outstanding. *(TutorBird, Trakist)*
- **Kehadiran** — tracking hadir/tidak hadir per sesi, hitung persentase kehadiran per murid. *(AzimKrishna)*
- **Tampilan bulan di kalender** — toggle antara tampilan minggu (sudah ada) dan tampilan bulan. Berguna untuk melihat kepadatan jadwal sebulan penuh. *(standar semua referensi kalender)*
- **Availabilitas guru** — set jam tersedia per guru agar tidak bisa dijadwalkan di luar jam tersebut. *(TutorBird)*
- **Export ke Google Calendar** — sync jadwal ke Google Calendar guru atau murid.

---

## 💰 Keuangan & Pembayaran

- **Cetak invoice PDF** — generate PDF tagihan per murid per bulan: daftar sesi, total jam, harga, total tagihan. Bisa di-share ke ortu via WhatsApp. Versi PNG per bulan untuk murid postpaid sudah ada (tombol Invoice di kartu murid, `getStudentInvoice` di helpers.ts); sisa: paket. *(AzimKrishna, TutorBird, LearnSpeed)*
- **Laporan pendapatan P&L** — grafik revenue per bulan, per guru, per kelompok murid, bandingkan antar bulan. *(TutorBird, LearnSpeed)*
- **Hitung honor guru** — hitung otomatis honor bulanan masing-masing guru berdasarkan sesi × rate. *(TutorBird, LearnSpeed)*
- **Expense tracking** — catat biaya (materi, transport) terhadap pendapatan untuk melihat profit bersih. *(TutorBird)*

---

## 👨‍🎓 Murid & Guru

- **Kontak ortu/murid** — tambah field: nomor WhatsApp, nama ortu. Berguna untuk reminder manual dan follow-up pembayaran langsung dari kartu murid. *(govind978, TutorBird, Tutor-Connect)*
- **Waitlist / leads** — daftar calon murid yang belum mulai les: nama, kontak, status (dihubungi, trial dijadwalkan). *(TutorBird)*
- **Foto murid** — upload foto untuk memudahkan identifikasi di daftar. *(umum)*
- **Activity log** — catat siapa yang mengubah data apa dan kapan (audit trail). *(TutorBird)*

---

## 🔔 Notifikasi & Reminder

- **Reminder otomatis WhatsApp** — kirim pesan pengingat ke murid/ortu N jam sebelum sesi via WA Business API atau WA link. *(TutorBird, Trakist)*
- **Push notification** — notifikasi H-1 atau 1 jam sebelum sesi via PWA push. *(umum)*
- **Sesi belum dikonfirmasi** — reminder kalau ada sesi hari ini yang belum diubah statusnya jadi completed.

---

## 👥 Multi-user & Portal

- **Link read-only untuk ortu** — generate link unik per murid yang bisa dibuka ortu tanpa login: jadwal, catatan sesi, status paket/pembayaran. Read-only. *(TutorBird, govind978)*
- **Role berbeda** — admin (akses penuh) vs guru (hanya lihat jadwal sendiri). *(LearnSpeed)*
- **Multi-bahasa** — Bahasa Indonesia, English, dan Mandarin.

---

## 🛠 Teknis & Data

- **Restore backup via UI** — backup harian ke Supabase Storage sudah berjalan, tapi belum ada UI untuk restore. Tambahkan di Settings: daftar backup → tombol restore ke titik tertentu. *(gap internal)*
- **Export laporan fleksibel** — pilih rentang tanggal bebas untuk export data sesi (lebih fleksibel dari export XuYuan per siklus yang sudah ada). *(AzimKrishna)*
- **Export PDF** — laporan keuangan dan jadwal dalam format PDF selain XLSX.

---

## Catatan Teknis untuk Implementasi

| Fitur | Catatan |
|---|---|
| Catatan per sesi | `notes` di `LessonSession` sudah ada di DB dan TypeScript, tinggal tambah UI |
| Laporan pendapatan | Ambil logika dari `src/pages/Finance.tsx` (snapshot harga, paket diakui di bulan beli, murid lembaga saat bayar) |
| Backup restore | File backup sudah ada di Supabase Storage bucket `backups/` |
