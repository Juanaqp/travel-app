-- Migración 6: tabla documents — documentos de viaje
-- Guarda referencia al archivo en Supabase Storage (no el binario en BD).
-- La Edge Function parse-document extrae metadatos del documento y los guarda en extracted_data.
-- trip_id es nullable: documentos como el pasaporte no pertenecen a un viaje específico.

CREATE TABLE documents (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nullable: el pasaporte o visado puede no estar asociado a un viaje concreto
  trip_id              UUID          REFERENCES trips(id) ON DELETE SET NULL,

  -- Datos del documento
  title                TEXT          NOT NULL,
  type                 document_type NOT NULL DEFAULT 'other',

  -- Ruta en Supabase Storage (ruta relativa del bucket 'documents')
  -- Ejemplo: '{user_id}/{document_id}/boarding_pass.pdf'
  storage_path         TEXT          NOT NULL,
  file_name            TEXT          NOT NULL,
  file_size_bytes      INTEGER       CHECK (file_size_bytes > 0),
  mime_type            TEXT,

  -- Metadatos extraídos por la Edge Function parse-document
  -- Estructura varía por tipo: vuelo → {flight_number, origin, destination},
  --   pasaporte → {number, nationality, expiry_date}, etc.
  extracted_data       JSONB         NOT NULL DEFAULT '{}'::jsonb,

  -- Fechas relevantes del documento (null si no aplica)
  issue_date           DATE,
  expiry_date          DATE,

  -- Soft delete
  deleted_at           TIMESTAMPTZ   DEFAULT NULL,

  -- Timestamps
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- RLS: solo el propietario puede acceder a sus documentos
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_documents"
  ON documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_documents"
  ON documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_documents"
  ON documents FOR UPDATE
  USING (user_id = auth.uid());

-- Índices
CREATE INDEX idx_documents_user_id    ON documents(user_id);
CREATE INDEX idx_documents_trip_id    ON documents(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_documents_type       ON documents(type);
-- Para alertas de documentos próximos a vencer (notificación document_expiry)
CREATE INDEX idx_documents_expiry     ON documents(expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documents_active     ON documents(user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
