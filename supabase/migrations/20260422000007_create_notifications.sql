-- Migración 7: tabla notifications — notificaciones push programadas
-- trigger_at define cuándo enviar la notificación (un worker/cron la procesa).
-- Las notificaciones son append-only: no se modifican una vez enviadas.
-- sent_at y read_at se actualizan puntualmente — no hay trigger de updated_at.

CREATE TABLE notifications (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nullable: algunas notificaciones no están asociadas a un viaje (bienvenida, plan)
  trip_id      UUID              REFERENCES trips(id) ON DELETE CASCADE,

  -- Contenido de la notificación
  type         notification_type NOT NULL DEFAULT 'general',
  title        TEXT              NOT NULL,
  body         TEXT              NOT NULL,

  -- Cuándo debe enviarse (el worker procesa las pendientes con trigger_at <= NOW())
  trigger_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  -- Cuándo se envió realmente (NULL si aún no se ha enviado)
  sent_at      TIMESTAMPTZ,
  -- Cuándo la leyó el usuario en la app
  read_at      TIMESTAMPTZ,

  -- Token de push al momento de programar la notificación
  -- Se guarda aquí porque el usuario puede cambiar de dispositivo
  push_token   TEXT,

  -- Datos adicionales para el deep link (qué pantalla abrir al tocar la notificación)
  -- Ejemplo: { screen: 'trips', tripId: 'xxx' }
  data         JSONB             NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamp de creación (inmutable)
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- RLS: el usuario solo puede leer sus propias notificaciones
-- La inserción la hace la Edge Function con service_role (no el cliente)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- El usuario puede marcar como leída (actualizar read_at)
CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Índices
-- El worker busca notificaciones pendientes (sin sent_at) con trigger_at vencido
CREATE INDEX idx_notifications_pending      ON notifications(trigger_at) WHERE sent_at IS NULL;
CREATE INDEX idx_notifications_user_unread  ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_trip_id      ON notifications(trip_id) WHERE trip_id IS NOT NULL;
