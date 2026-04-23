-- Migración 1: enums del proyecto + función auxiliar de updated_at
-- Usa DO $$ ... EXCEPTION WHEN duplicate_object ... END $$ para ser idempotente:
-- PostgreSQL no tiene CREATE TYPE IF NOT EXISTS, este patrón es el equivalente.

-- Función auxiliar para mantener updated_at sincronizado (CREATE OR REPLACE es idempotente)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Estado del viaje a lo largo de su ciclo de vida
DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('planning', 'confirmed', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Plan de suscripción del usuario
DO $$ BEGIN
  CREATE TYPE user_plan AS ENUM ('free', 'pro', 'team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ritmo de viaje preferido para generación de itinerario
DO $$ BEGIN
  CREATE TYPE travel_pace AS ENUM ('slow', 'moderate', 'intense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nivel de presupuesto para generación de itinerario
DO $$ BEGIN
  CREATE TYPE budget_tier AS ENUM ('budget', 'mid', 'premium', 'luxury');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Categoría de gasto de viaje
DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'transport', 'accommodation', 'food', 'activities',
    'shopping', 'health', 'communication', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Método por el que se registró el gasto
DO $$ BEGIN
  CREATE TYPE expense_input_method AS ENUM ('manual', 'ocr', 'ai_parsed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de documento de viaje
DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'passport', 'visa', 'flight', 'hotel', 'insurance', 'car_rental', 'tour', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de notificación push
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'trip_reminder', 'flight_alert', 'document_expiry',
    'itinerary_ready', 'expense_limit', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado del itinerario generado por IA
DO $$ BEGIN
  CREATE TYPE itinerary_status AS ENUM ('draft', 'reviewing', 'approved', 'saved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Acción del usuario sobre un elemento generado por IA
DO $$ BEGIN
  CREATE TYPE ai_feedback_action AS ENUM ('approved', 'rejected', 'modified', 'regenerated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
