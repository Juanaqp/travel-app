-- Migración 2: tabla users — extiende auth.users con perfil de aplicación
-- Se crea un trigger que inserta automáticamente una fila aquí al registrarse en Supabase Auth.
-- La FK referencia auth.users: si el usuario elimina su cuenta de Auth, se elimina en cascada.

CREATE TABLE users (
  -- La PK es el mismo UUID que auth.users — no generamos un UUID nuevo
  id                          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                       TEXT        NOT NULL,
  full_name                   TEXT,
  avatar_url                  TEXT,

  -- Plan de suscripción
  plan                        user_plan   NOT NULL DEFAULT 'free',

  -- Límite de mensajes de IA (contador para rate-limiting O(1))
  -- La Edge Function incrementa ai_messages_used_this_month antes de llamar al LLM
  ai_messages_used_this_month INTEGER     NOT NULL DEFAULT 0,
  ai_messages_limit           INTEGER     NOT NULL DEFAULT 20,
  -- Fecha en la que se resetea el contador (primer día del mes siguiente)
  ai_messages_reset_at        TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',

  -- Preferencias del usuario
  preferred_currency          TEXT        NOT NULL DEFAULT 'USD',
  preferred_language          TEXT        NOT NULL DEFAULT 'es',

  -- Timestamps
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: el usuario solo puede leer y modificar su propio perfil
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Índice en email para búsquedas de admin (útil para soporte)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan  ON users(plan);

-- Trigger de updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función que crea el perfil automáticamente al registrarse en Supabase Auth
-- SECURITY DEFINER permite insertar en public.users aunque el JWT no tenga permisos todavía
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en auth.users — se dispara cada vez que un usuario se registra
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
