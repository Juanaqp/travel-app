-- Migración 14: campos de timezone en itinerarios y gastos
-- destination_timezone: IANA timezone del destino principal (ej: "Europe/Rome")
-- local_timezone en expenses: timezone donde se realizó el gasto

ALTER TABLE itineraries
  ADD COLUMN IF NOT EXISTS destination_timezone TEXT;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS local_timezone TEXT;

-- Índice para búsquedas por timezone (útil para alertas agrupadas por zona)
CREATE INDEX IF NOT EXISTS idx_itineraries_timezone
  ON itineraries(destination_timezone)
  WHERE destination_timezone IS NOT NULL;
