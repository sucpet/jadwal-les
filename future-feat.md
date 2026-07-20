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

---

## 📝 Catatan & Progress Murid

- **Catatan per sesi** — field `notes` di `LessonSession` sudah ada di model tapi belum ada UI-nya. Tambahkan area tulis catatan saat menandai sesi selesai: materi, performa, PR diberikan. *(govind978, TutorBird, LearnSpeed)*
- **Homework tracking** — catat PR yang diberikan tiap sesi dan apakah sudah dikerjakan di sesi berikutnya. *(govind978, TutorBird)*
- **Target belajar per murid** — field di profil murid terpisah dari `notes` umum: "Persiapan UTBK Matematika", "Fokus reading IELTS". Agar tujuan jangka panjang tidak tenggelam di catatan operasional. *(LearnSpeed, TutorBird)*
- **Catatan perkembangan** — log progress per sesi, topik yang dipelajari, nilai/skor jika ada. *(LearnSpeed)*

---

## 📅 Jadwal & Kehadiran

- **Status batal + alasan** — ganti "hapus sesi" dengan status `cancelled` disertai alasan (murid absen, guru berhalangan, dll). Sesi yang dibatalkan tetap tercatat di histori dan **tidak mengurangi slot paket**. *(TutorBird, LearnSpeed, Trakist)*
- **Sesi make-up / pengganti** — saat sesi dibatalkan, tandai "perlu make-up". Saat sesi pengganti dijadwalkan, link ke sesi aslinya. Dashboard tampilkan berapa make-up masih outstanding. *(TutorBird, Trakist)*
- **Kehadiran** — tracking hadir/tidak hadir per sesi, hitung persentase kehadiran per murid. *(AzimKrishna)*
- **Reschedule mudah** — tombol reschedule langsung dari kartu sesi tanpa harus buka form manual. *(Trakist)*
- **Drag & drop kalender** — geser event langsung di kalender untuk reschedule, tanpa buka form. *(standar FullCalendar, DHTMLX)*
- **Tampilan bulan di kalender** — toggle antara tampilan minggu (sudah ada) dan tampilan bulan. Berguna untuk melihat kepadatan jadwal sebulan penuh. *(standar semua referensi kalender)*
- **Availabilitas guru** — set jam tersedia per guru agar tidak bisa dijadwalkan di luar jam tersebut. *(TutorBird)*
- **Export ke Google Calendar** — sync jadwal ke Google Calendar guru atau murid.

---

## 💰 Keuangan & Pembayaran

- **Status pembayaran per murid/siklus** — tandai apakah tagihan sudah "lunas" atau belum per bulan/siklus. Dashboard tampilkan siapa yang belum bayar. *(AzimKrishna, Trakist, TutorBird)*
- **Cetak invoice PDF** — generate PDF tagihan per murid per bulan/siklus: daftar sesi, total jam, harga, total tagihan. Bisa di-share ke ortu via WhatsApp. `getMonthlyRevenue` di helpers.ts sudah ada sebagai fondasi. *(AzimKrishna, TutorBird, LearnSpeed)*
- **Reminder tagihan overdue** — notifikasi otomatis ke admin kalau invoice belum "lunas" setelah N hari. *(TutorBird)*
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
| Laporan pendapatan | `getMonthlyRevenue` di `src/utils/helpers.ts` sudah ada, belum dipakai di halaman |
| Status `cancelled` | Perlu migrasi DB: tambah enum value `cancelled` ke kolom `status` |
| Backup restore | File backup sudah ada di Supabase Storage bucket `backups/` |
