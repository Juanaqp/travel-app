-- Migración 3: tabla trips — viajes del usuario
-- destinations usa JSONB en lugar de tabla separada para simplificar el MVP.
-- Estructura de cada elemento en destinations:
--   { city: string, country: string, lat?: number, lng?: number,
--     arrival_date?: string, departure_date?: string }

CREATE TABLE trips (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos básicos del viaje
  title           TEXT        NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  status          trip_status NOT NULL DEFAULT 'planning',

  -- Lista de destinos — JSONB para evitar tabla intermedia en el MVP
  -- El índice GIN permite buscar trips por ciudad o país
  destinations    JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Fechas del viaje completo (pueden estar vacías al inicio)
  start_date      DATE,
  end_date        DATE,

  -- Configuración de viaje usada para generar el itinerario
  travelers_count INTEGER     NOT NULL DEFAULT 1 CHECK (travelers_count BETWEEN 1 AND 50),
  pace            travel_pace,
  budget          budget_tier,
  base_currency   TEXT        NOT NULL DEFAULT 'USD',

  -- Soft delete — nunca DELETE físico
  deleted_at      TIMESTAMPTZ DEFAULT NULL,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: solo el propietario puede ver, crear y modificar sus viajes
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_trips"
  ON trips FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_trips"
  ON trips FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_trips"
  ON trips FOR UPDATE
  USING (user_id = auth.uid());

-- Índices para las queries más frecuentes
CREATE INDEX idx_trips_user_id     ON trips(user_id);
CREATE INDEX idx_trips_status      ON trips(status);
-- Índice parcial: excluye los viajes con soft delete en la mayoría de queries
CREATE INDEX idx_trips_active      ON trips(user_id, created_at DESC) WHERE deleted_at IS NULL;
-- GIN para buscar dentro de destinations: .contains({ city: 'París' })
CREATE INDEX idx_trips_destinations ON trips USING GIN(destinations);

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
