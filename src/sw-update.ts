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
