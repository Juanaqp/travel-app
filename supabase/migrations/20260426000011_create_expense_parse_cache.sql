-- Migración 11: caché de resultados del parseador de gastos por IA
-- Evita reprocesar el mismo texto en llamadas repetidas (TTL: 24h en app).
-- Reutiliza el mismo patrón que document_parse_cache.

CREATE TABLE expense_parse_cache (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash  TEXT      NOT NULL UNIQUE,
  result     JSONB     NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expense_parse_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_expense_cache"
  ON expense_parse_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_expense_cache"
  ON expense_parse_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);
