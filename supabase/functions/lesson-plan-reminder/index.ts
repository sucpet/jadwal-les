// Dipanggil pg_cron tiap 5 menit pukul 21:00–23:55 WIB (SPEC-lesson-plan-reminder.md).
// Kirim satu pesan Telegram per guru yang masih punya sesi XuYuan hari ini yang sudah selesai
// tapi lesson plan-nya belum ditandai. Tombol "lp:<sessionId>" ditangani telegram-webhook.
// ponytail: logika filter disalin dari src/utils/lessonPlan.ts (Deno & Vite tidak berbagi build) — ubah keduanya.
// Deploy dengan --no-verify-jwt; keamanan lewat header x-cron-secret (nilai disimpan di Vault untuk pg_cron).
import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CRON_SECRET = Deno.env.get('LESSON_PLAN_CRON_SECRET')!;
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Tanggal & jam WIB sekarang: ['YYYY-MM-DD', 'HH:MM'].
function nowWIB(): [string, string] {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return [`${p.year}-${p.month}-${p.day}`, `${p.hour}:${p.minute}`];
}

Deno.serve(async req => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('unauthorized', { status: 401 });

  // Uji manual: ?now=YYYY-MM-DDTHH:MM (abaikan jam dinding) dan ?teacher=<id> (hanya guru itu).
  const url = new URL(req.url);
  const [today, hhmm] = url.searchParams.get('now')?.split('T') ?? nowWIB();
  const onlyTeacher = url.searchParams.get('teacher');
  if (hhmm < '21:00') return Response.json({ skipped: 'before 21:00 WIB', today, hhmm });

  let tq = db.from('teachers').select('id, telegram_chat_id').not('telegram_chat_id', 'is', null).eq('is_active', true);
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
    if (!mine.length) continue;
    // deno-lint-ignore no-explicit-any
    const name = (s: any) => s.students?.name ?? '—';
    const lines = mine.map(s => `• ${name(s)} ${s.start_time}–${s.end_time}`).join('\n');
    const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: t.telegram_chat_id,
        text: `📝 Lesson plan XuYuan hari ini belum diisi:\n${lines}\n\nIsi di GSheet XuYuan, lalu tekan tombol di bawah.`,
        reply_markup: { inline_keyboard: mine.map(s => [{ text: `✅ ${name(s)} ${s.start_time}`, callback_data: `lp:${s.id}` }]) },
      }),
    });
    if (res.ok) sent++; else console.error('sendMessage', t.id, res.status, await res.text());
  }
  return Response.json({ today, hhmm, sent });
});
