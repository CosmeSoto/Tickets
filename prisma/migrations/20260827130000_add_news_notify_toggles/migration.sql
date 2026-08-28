-- Toggles por noticia: el autor decide si, además de la notificación
-- in-app, la noticia se envía por email y/o Telegram a sus destinatarios
-- (ver notifyNewsPublished en src/lib/news/notify-news-published.ts).
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "notify_email" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "notify_telegram" BOOLEAN NOT NULL DEFAULT false;
