// Cek service worker baru secara berkala + saat tab kembali fokus/visible.
// registerType 'autoUpdate' + skipWaiting/clientsClaim akan meng-aktifkan SW baru
// dan me-reload app otomatis begitu update ditemukan — jadi laoshi selalu dapat
// versi terbaru walau app dibiarkan terbuka lama.
export function setupSwAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  const check = () =>
    navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => { /* offline: abaikan */ });

  setInterval(check, 15 * 60 * 1000); // tiap 15 menit
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

// Setelah deploy baru, chunk halaman versi lama sudah tidak ada (Vercel membalas index.html),
// jadi import halaman gagal dan spinner berputar terus. Reload sekali untuk memuat versi terbaru;
// jeda 10 detik mencegah reload berulang kalau memang offline/error lain.
export function setupChunkReload(): void {
  window.addEventListener('vite:preloadError', e => {
    const last = Number(sessionStorage.getItem('chunk-reload-at') ?? 0);
    if (Date.now() - last < 10_000) return;
    e.preventDefault();
    sessionStorage.setItem('chunk-reload-at', String(Date.now()));
    location.reload();
  });
}
