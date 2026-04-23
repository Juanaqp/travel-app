-- Migración 5: tabla expenses — gastos del viaje
-- Soporta entrada manual, OCR de foto de recibo, y parseo por IA (parse-expense Edge Function).
-- Soft delete: archivar gastos en lugar de eliminarlos (útil para informes históricos).

CREATE TABLE expenses (
  id                      UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                 UUID                  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id                 UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Datos del gasto
  description             TEXT                  NOT NULL,
  amount                  DECIMAL(12, 2)        NOT NULL CHECK (amount >= 0),
  currency                TEXT                  NOT NULL DEFAULT 'USD',
  -- Importe convertido a la moneda base del viaje (calculado al guardar)
  amount_in_base_currency DECIMAL(12, 2),

  category                expense_category      NOT NULL DEFAULT 'other',
  input_method            expense_input_method  NOT NULL DEFAULT 'manual',

  -- Contexto temporal y geográfico
  spent_at                TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  location                TEXT,
  notes                   TEXT,

  -- Referencia al recibo en Supabase Storage (ruta relativa del bucket)
  -- Ejemplo: 'receipts/{user_id}/{trip_id}/{expense_id}.jpg'
  receipt_storage_path    TEXT,

  -- Soft delete
  deleted_at              TIMESTAMPTZ           DEFAULT NULL,

  -- Timestamps
  created_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- RLS: solo el propietario puede ver, crear y modificar sus gastos
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_expenses"
  ON expenses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_expenses"
  ON expenses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_expenses"
  ON expenses FOR UPDATE
  USING (user_id = auth.uid());

-- Índices para las queries más frecuentes
CREATE INDEX idx_expenses_trip_id    ON expenses(trip_id);
CREATE INDEX idx_expenses_user_id    ON expenses(user_id);
CREATE INDEX idx_expenses_category   ON expenses(category);
-- Orden cronológico descendente (lista de gastos más recientes primero)
CREATE INDEX idx_expenses_spent_at   ON expenses(trip_id, spent_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
