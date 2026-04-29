-- Migración 12: añade columnas de onboarding a la tabla users
-- Permite detectar si un usuario completó el flujo de configuración inicial
-- y guardar sus preferencias de viaje capturadas durante el onboarding.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed  BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS timezone              TEXT          NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS travel_interests      TEXT[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_pace        travel_pace,
  ADD COLUMN IF NOT EXISTS preferred_budget      budget_tier;

-- Índice parcial para encontrar usuarios que aún no completaron el onboarding
-- (útil en métricas y posibles cron jobs de reactivación)
CREATE INDEX IF NOT EXISTS idx_users_onboarding_pending
  ON users(id)
  WHERE onboarding_completed = FALSE;
