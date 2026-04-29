-- Migración 9: document_parse_cache — caché de resultados de parseo de documentos
-- Evita llamadas redundantes a OpenAI para documentos ya procesados.
-- Keyed por hash SHA-256 del contenido del archivo (sin datos de usuario ni PII).
-- Lectura e inserción permitidas a usuarios autenticados — sin datos sensibles.

CREATE TABLE document_parse_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hash SHA-256 del archivo (primeros 32 caracteres hex del digest)
  file_hash   TEXT        NOT NULL UNIQUE,
  -- Resultado completo del parseo (type, confidence, raw_text, fields)
  result      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE document_parse_cache ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer el caché (sin PII — resultado de IA)
CREATE POLICY "authenticated_select_document_cache"
  ON document_parse_cache FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede insertar resultados en el caché
CREATE POLICY "authenticated_insert_document_cache"
  ON document_parse_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_document_parse_cache_hash    ON document_parse_cache(file_hash);
CREATE INDEX idx_document_parse_cache_created ON document_parse_cache(created_at);
