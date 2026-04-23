-- Migración 8: tablas de soporte — itinerary_cache y ai_feedback
--
-- itinerary_cache: guarda el borrador del itinerario mientras el usuario lo revisa.
--   El borrador vive aquí (no en `itineraries`) hasta que el usuario lo aprueba.
--   Al aprobar, la Edge Function mueve el graph a `itineraries` y elimina la caché.
--   expires_at permite limpiar borradores abandonados con un cron job.
--
-- ai_feedback: registra cada acción del usuario sobre contenido generado por IA.
--   Sirve para mejorar los prompts futuros y para analytics de calidad.

-- ─── itinerary_cache ─────────────────────────────────────────────────────────

CREATE TABLE itinerary_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  -- Borrador del grafo — misma estructura que itineraries.graph
  graph        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  user_prompt  TEXT        NOT NULL DEFAULT '',
  generated_by TEXT        NOT NULL DEFAULT 'claude-sonnet-4-5',

  -- El borrador expira en 24h si el usuario no lo aprueba ni lo descarta
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

  -- Timestamps
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE itinerary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_cache"
  ON itinerary_cache FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_cache"
  ON itinerary_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_cache"
  ON itinerary_cache FOR UPDATE
  USING (user_id = auth.uid());

-- El usuario puede descartar su propio borrador (DELETE real — no es dato de negocio)
CREATE POLICY "users_delete_own_cache"
  ON itinerary_cache FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_itinerary_cache_user_trip ON itinerary_cache(user_id, trip_id);
-- Para el cron que limpia borradores expirados
CREATE INDEX idx_itinerary_cache_expires   ON itinerary_cache(expires_at);

CREATE TRIGGER update_itinerary_cache_updated_at
  BEFORE UPDATE ON itinerary_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── ai_feedback ─────────────────────────────────────────────────────────────

CREATE TABLE ai_feedback (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nullable: el viaje o itinerario pueden haberse archivado
  trip_id           UUID               REFERENCES trips(id) ON DELETE SET NULL,
  itinerary_id      UUID               REFERENCES itineraries(id) ON DELETE SET NULL,

  -- Qué elemento fue evaluado (node_id es un string interno del JSONB, no una FK)
  node_id           TEXT,

  action            ai_feedback_action NOT NULL,

  -- Contenido original generado por IA (snapshot en el momento del feedback)
  original_content  JSONB              NOT NULL DEFAULT '{}'::jsonb,
  -- Contenido después de la modificación del usuario (vacío si action = 'approved')
  modified_content  JSONB              NOT NULL DEFAULT '{}'::jsonb,
  -- Comentario libre del usuario (opcional)
  user_comment      TEXT,

  -- Timestamp inmutable
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_ai_feedback"
  ON ai_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_ai_feedback"
  ON ai_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_ai_feedback_user_id     ON ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_trip_id     ON ai_feedback(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_ai_feedback_action      ON ai_feedback(action);
CREATE INDEX idx_ai_feedback_itinerary   ON ai_feedback(itinerary_id) WHERE itinerary_id IS NOT NULL;
