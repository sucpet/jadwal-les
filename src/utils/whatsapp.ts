// Helper WhatsApp (semi-otomatis via link wa.me — buka WA dengan pesan terisi, kirim manual).

// Normalisasi nomor Indonesia ke format internasional tanpa '+': 62xxxxxxxxxx
// Contoh: "0812-3456-7890" -> "6281234567890", "+62 812..." -> "62812...", "812..." -> "62812..."
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return '';
  let d = raw.replace(/\D/g, ''); // buang semua non-digit (spasi, -, +, dst)
  if (!d) return '';
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('62')) { /* sudah benar */ }
  else if (d.startsWith('8')) d = '62' + d; // nomor tanpa 0 depan
  return d;
}

// true jika nomor bisa dipakai (minimal masuk akal untuk WA Indonesia)
export function isValidPhone(raw: string | undefined | null): boolean {
  const d = normalizePhone(raw);
  return d.length >= 10 && d.length <= 15;
}

// Bangun link wa.me dengan pesan ter-encode. Return '' kalau nomor tidak valid.
export function waLink(phone: string | undefined | null, message?: string): string {
  const d = normalizePhone(phone);
  if (!isValidPhone(d)) return '';
  return message ? `https://wa.me/${d}?text=${encodeURIComponent(message)}` : `https://wa.me/${d}`;
}
