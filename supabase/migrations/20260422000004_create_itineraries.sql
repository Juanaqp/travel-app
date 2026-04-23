-- Migración 4: tabla itineraries — itinerarios generados por IA
-- El grafo completo (nodos, aristas, días) se almacena como JSONB en la columna `graph`.
-- Esto evita una tabla `itinerary_nodes` separada y simplifica el MVP.
-- El itinerario SOLO se persiste cuando el usuario lo aprueba (status = 'approved').
-- Mientras está en draft/reviewing, vive en itinerary_cache (migración 000008).
-- Estructura de `graph`: ver packages/types/itinerary.ts → ItineraryGraph

CREATE TABLE itineraries (
  id                      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                 UUID              NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id                 UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status                  itinerary_status  NOT NULL DEFAULT 'approved',
  -- Solo se inserta cuando status pasa a 'approved' — el draft vive en itinerary_cache

  -- Grafo completo del itinerario
  -- Índice GIN para buscar nodos específicos dentro del JSON
  graph                   JSONB             NOT NULL DEFAULT '{}'::jsonb,

  -- Metadatos de generación IA
  generated_by            TEXT              NOT NULL DEFAULT 'claude-sonnet-4-5',
  user_prompt             TEXT              NOT NULL DEFAULT '',
  generation_tokens_used  INTEGER,

  -- Soft delete — permite "archivar" itinerarios sin perder historial
  deleted_at              TIMESTAMPTZ       DEFAULT NULL,

  -- Timestamps
  created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- RLS: solo el propietario puede acceder a sus itinerarios
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_itineraries"
  ON itineraries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_itineraries"
  ON itineraries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_itineraries"
  ON itineraries FOR UPDATE
  USING (user_id = auth.uid());

-- Índices
CREATE INDEX idx_itineraries_trip_id    ON itineraries(trip_id);
CREATE INDEX idx_itineraries_user_id    ON itineraries(user_id);
CREATE INDEX idx_itineraries_status     ON itineraries(status);
CREATE INDEX idx_itineraries_active     ON itineraries(trip_id, created_at DESC) WHERE deleted_at IS NULL;
-- GIN para buscar nodos específicos dentro del grafo: tipo de nodo, nombre, etc.
CREATE INDEX idx_itineraries_graph      ON itineraries USING GIN(graph);

CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON itineraries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
