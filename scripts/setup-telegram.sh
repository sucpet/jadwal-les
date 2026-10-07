#!/bin/zsh
# Sekali jalan oleh developer: simpan token bot + secret webhook ke Supabase, lalu daftarkan webhook ke Telegram.
# Token diketik di prompt (tidak tampil, tidak masuk history/repo). Jalankan ulang kalau token bot diganti.
set -e
PROJECT=vuyvfuthefgplmwfzzmt
read -s "TOKEN?Token bot dari @BotFather: "; echo
TOKEN=${TOKEN//[[:space:]]/}   # buang spasi/enter yang ikut ter-paste
SECRET=$(openssl rand -hex 32)
supabase secrets set --project-ref $PROJECT TELEGRAM_BOT_TOKEN="$TOKEN" TELEGRAM_WEBHOOK_SECRET="$SECRET"
curl -sS -m 20 "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -d url="https://$PROJECT.supabase.co/functions/v1/telegram-webhook" \
  -d secret_token="$SECRET" \
  -d allowed_updates='["message","callback_query"]' || echo "Gagal menghubungi Telegram (exit $?)"
echo
unset TOKEN SECRET
