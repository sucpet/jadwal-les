// Webhook bot Telegram (SPEC-lesson-plan-reminder.md).
// - "/start <token>": hubungkan chat ke guru lewat token sekali pakai dari tombol "Hubungkan Telegram" di app.
// - Tombol "Sudah diisi" (callback_data "lp:<sessionId>"): isi sessions.lesson_plan_done_at.
// Deploy dengan --no-verify-jwt (Telegram tidak mengirim JWT); keamanan lewat header secret_token.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const tg = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

async function handleStart(chatId: number, token: string | undefined) {
  if (!token) {
    return tg('sendMessage', { chat_id: chatId, text: 'Buka app Jadwal Les → Settings → Hubungkan Telegram untuk menghubungkan akun.' });
  }
  const { data: link } = await db.from('telegram_link_tokens')
    .select('teacher_id').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!link) {
    return tg('sendMessage', { chat_id: chatId, text: 'Link tidak valid atau sudah kedaluwarsa. Tekan "Hubungkan Telegram" lagi di app.' });
  }
  await db.from('telegram_link_tokens').delete().eq('token', token);
  const { data: teacher } = await db.from('teachers')
    .update({ telegram_chat_id: chatId }).eq('id', link.teacher_id).select('name').single();
  return tg('sendMessage', { chat_id: chatId, text: `✅ Terhubung sebagai ${teacher?.name}. Pengingat lesson plan XuYuan akan dikirim mulai pukul 21:00 kalau ada yang belum diisi.` });
}

// deno-lint-ignore no-explicit-any
async function handleDone(cb: any) {
  const chatId: number = cb.message.chat.id;
  const sessionId = String(cb.data).slice(3);
  // Hanya sesi milik guru yang terhubung ke chat ini yang boleh ditandai.
  const { data: teachers } = await db.from('teachers').select('id, name').eq('telegram_chat_id', chatId);
  const teacher = teachers?.[0];
  const { data: session } = teacher
    ? await db.from('sessions').update({ lesson_plan_done_at: new Date().toISOString() })
        .eq('id', sessionId).in('teacher_id', teachers!.map(t => t.id)).is('lesson_plan_done_at', null)
        .select('date, start_time, students(name)').maybeSingle()
    : { data: null };

  if (session) {
    // deno-lint-ignore no-explicit-any
    const student = (session as any).students?.name ?? '—';
    await db.from('activity_log').insert({
      id: crypto.randomUUID(), action: 'update', user_name: teacher!.name, created_at: new Date().toISOString(),
      description: `Lesson plan diisi — ${student}, ${fmtDate(session.date)} ${session.start_time} (Telegram)`,
    });
  }
  // Buang tombol sesi ini dari pesan; sisa tombol (sesi lain) tetap.
  // deno-lint-ignore no-explicit-any
  const rows = (cb.message.reply_markup?.inline_keyboard ?? []).filter((r: any[]) => r[0]?.callback_data !== cb.data);
  await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: rows } });
  return tg('answerCallbackQuery', { callback_query_id: cb.id, text: teacher ? '✅ Tercatat' : 'Chat ini belum terhubung ke akun guru.' });
}

Deno.serve(async req => {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('unauthorized', { status: 401 });
  const update = await req.json();
  try {
    const text: string | undefined = update.message?.text;
    if (text?.startsWith('/start')) await handleStart(update.message.chat.id, text.split(' ')[1]);
    else if (update.callback_query?.data?.startsWith('lp:')) await handleDone(update.callback_query);
  } catch (e) {
    console.error(e);
  }
  return new Response('ok'); // selalu 200 supaya Telegram tidak mengulang update
});
