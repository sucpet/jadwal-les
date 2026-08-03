# Student Portal — Rencana Pengembangan

Fitur ini memungkinkan murid booking jadwal dan bayar langsung lewat aplikasi.
Effort: besar. Cocok dikerjakan saat jumlah murid sudah cukup banyak untuk justifikasi.

---

## Komponen utama

### 1. Auth murid
- Login terpisah dari admin (nomor HP + OTP, atau email)
- Supabase Auth untuk murid, RLS diperluas: murid hanya bisa akses data miliknya
- Route terpisah: `/student/...`

### 2. Portal murid (UI)
- Lihat slot tersedia berdasarkan jadwal laoshi
- Booking sesi → status `pending` atau langsung `scheduled`
- Riwayat sesi & status pembayaran
- **Keputusan yang perlu dibuat:** booking langsung konfirm, atau admin approve dulu?

### 3. Pembayaran — Midtrans Snap
- Support QRIS, transfer bank, e-wallet, kartu kredit
- Biaya: ~2–2.8% per transaksi (tergantung metode)
- Setup: daftar di midtrans.com, dapat Merchant ID + Server Key
- Flow:
  1. Murid klik "Bayar"
  2. Backend buat Midtrans transaction token
  3. Snap popup terbuka → murid bayar
  4. Midtrans kirim webhook ke backend saat sukses
  5. Backend verifikasi signature → update status di DB

### 4. Backend minimal
- Butuh server/serverless untuk:
  - Buat Midtrans transaction token (pakai Server Key — tidak boleh di frontend)
  - Verifikasi webhook dari Midtrans
- Opsi: Vercel API Routes (sudah pakai Vercel) atau Supabase Edge Functions
- Vercel API Routes lebih mudah karena sudah di ekosistem yang sama

### 5. Notifikasi admin
- Push notification atau WA semi-auto saat ada booking/pembayaran baru

---

## Perubahan DB yang diperlukan
- Tabel `student_users` atau extend Supabase Auth untuk murid
- Kolom `status` di `sessions`: tambah `pending` (menunggu konfirmasi/pembayaran)
- Tabel `payments` sudah ada — perlu kolom `midtrans_order_id`, `payment_method`
- RLS policies baru untuk akses murid

---

## Urutan pengerjaan yang disarankan
1. Auth murid (Supabase Auth + RLS)
2. Portal read-only: murid lihat jadwal & riwayat mereka
3. Booking flow (tanpa bayar dulu)
4. Integrasi Midtrans
5. Notifikasi admin

---

## Referensi
- Midtrans Snap docs: https://docs.midtrans.com/docs/snap-overview
- Vercel API Routes: https://vercel.com/docs/functions
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
