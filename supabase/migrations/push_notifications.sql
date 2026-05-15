-- Tabla para almacenar suscripciones push por usuario/dispositivo
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, endpoint)
);

-- RLS: cada usuario solo ve sus propias suscripciones
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subs_own" ON push_subscriptions
  FOR ALL USING (auth.uid() = usuario_id);

-- pg_cron: disparar send-notifications todos los días a las 8am UTC-6 (= 14:00 UTC)
-- Requiere que la extensión pg_cron esté habilitada en Supabase (Database → Extensions)
SELECT cron.schedule(
  'jm-finance-daily-notifications',
  '0 14 * * *',  -- 14:00 UTC = 8:00 AM hora México (UTC-6)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
