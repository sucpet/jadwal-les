// Dipanggil pg_cron tiap 5 menit pukul 21:00–23:55 WIB (SPEC-lesson-plan-reminder.md).
// Kirim satu pesan Telegram per guru yang masih punya sesi XuYuan hari ini yang sudah selesai
// tapi lesson plan-nya belum ditandai. Tombol "lp:<sessionId>" ditangani telegram-webhook.
// Hanya pesan terakhir yang punya tombol: tombol pesan sebelumnya dihapus saat pesan baru terkirim,
// atau saat tidak ada lagi sesi yang belum ditandai.
// ponytail: logika filter disalin dari src/utils/lessonPlan.ts (Deno & Vite tidak berbagi build) — ubah keduanya.
// Deploy dengan --no-verify-jwt; keamanan lewat header x-cron-secret (nilai disimpan di Vault untuk pg_cron).
import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CRON_SECRET = Deno.env.get('LESSON_PLAN_CRON_SECRET')!;
// Jam mulai pengingat (WIB). Default 21:00; bisa diubah sementara lewat secret REMINDER_START untuk uji.
const START = Deno.env.get('REMINDER_START') ?? '21:00';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const tg = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

// Hapus tombol dari pesan lama. Gagal (pesan sudah dihapus/terlalu lama) tidak masalah.
const clearButtons = (chatId: number, messageId: number) =>
  tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});

// Tanggal & jam WIB sekarang: ['YYYY-MM-DD', 'HH:MM'].
function nowWIB(): [string, string] {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return [`${p.year}-${p.month}-${p.day}`, `${p.hour}:${p.minute}`];
}

// Simpan ID pesan baru secara atomik (RPC swap_reminder_msg), lalu hapus tombol pesan yang digantikan.
async function swapAndClear(teacherId: string, chatId: number, newMsg: number | null) {
  const { data: oldMsg, error } = await db.rpc('swap_reminder_msg', { p_teacher: teacherId, p_msg: newMsg });
  if (error) { console.error('swap_reminder_msg', teacherId, error); return; }
  if (oldMsg && oldMsg !== newMsg) await clearButtons(chatId, oldMsg);
}

Deno.serve(async req => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('unauthorized', { status: 401 });

  // Uji manual: ?now=YYYY-MM-DDTHH:MM (abaikan jam dinding) dan ?teacher=<id> (hanya guru itu).
  const url = new URL(req.url);
  const [today, hhmm] = url.searchParams.get('now')?.split('T') ?? nowWIB();
  const onlyTeacher = url.searchParams.get('teacher');
  if (hhmm < START) return Response.json({ skipped: `before ${START} WIB`, today, hhmm });

  let tq = db.from('teachers').select('id, telegram_chat_id, telegram_reminder_msg_id').not('telegram_chat_id', 'is', null).eq('is_active', true);
  if (onlyTeacher) tq = tq.eq('id', onlyTeacher);
  const { data: teachers, error: te } = await tq;
  if (te) throw te;
  if (!teachers?.length) return Response.json({ today, hhmm, sent: 0 });

  const { data: sessions, error: se } = await db.from('sessions')
    .select('id, teacher_id, start_time, end_time, students!inner(name, group)')
    .eq('date', today).is('lesson_plan_done_at', null).lte('end_time', hhmm)
    .eq('students.group', 'xuyuan').in('teacher_id', teachers.map(t => t.id))
    .order('start_time');
  if (se) throw se;

  let sent = 0;
  for (const t of teachers) {
    const mine = (sessions ?? []).filter(s => s.teacher_id === t.id);
    if (!mine.length) {
      if (t.telegram_reminder_msg_id) await swapAndClear(t.id, t.telegram_chat_id, null);
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const name = (s: any) => s.students?.name ?? '—';
    // deno-lint-ignore no-explicit-any
    const label = (s: any) => `${name(s)} - ${s.start_time}–${s.end_time}`;
    const lines = mine.map(s => `• ${label(s)}`).join('\n');
    const res = await tg('sendMessage', {
      chat_id: t.telegram_chat_id,
      text: `📝 CUYYYY!!! Lesson plan XuYuan hari ini belum diisi nih, gaskeun diisi dulu:\n${lines}\n\nIsi di GSheet XuYuan dulu baru pencet tombol dibawah ini yaa cuy!!!`,
      reply_markup: { inline_keyboard: mine.map(s => [{ text: `✅ ${label(s)}`, callback_data: `lp:${s.id}` }]) },
    });
    if (!res.ok) { console.error('sendMessage', t.id, res.status, await res.text()); continue; }
    sent++;
    // Pesan baru sudah terkirim, baru hapus tombol pesan lama (selalu ada satu pesan dengan tombol).
    const { result } = await res.json();
    await swapAndClear(t.id, t.telegram_chat_id, result.message_id);
  }
  return Response.json({ today, hhmm, sent });
});
