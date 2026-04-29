-- Migración 10: añade presupuesto numérico total a trips
-- Permite mostrar barra de progreso de gasto en la pantalla de gastos.
-- Columna opcional — NULL significa que el usuario no ha definido un presupuesto.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS total_budget DECIMAL(12, 2) DEFAULT NULL;
