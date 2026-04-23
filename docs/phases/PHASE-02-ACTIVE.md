# Fase 2 — Schema de base de datos

## Estado: 🔄 En progreso

## Objetivo

Definir la fuente de verdad del sistema: tipos TypeScript en `packages/types/`, migraciones
SQL ordenadas en `supabase/migrations/`, y Row Level Security en todas las tablas.
Al final de esta fase, `supabase gen types typescript --local` genera `packages/types/database.ts`
y el proyecto typechecks con 0 errores usando esos tipos generados.

## Tablas a crear (8)

| Tabla | Propósito |
|---|---|
| `users` | Perfil extendido del usuario (sobre `auth.users` de Supabase) |
| `trips` | Viajes del usuario: destinos, fechas, estado, soft delete |
| `destinations` | Destinos dentro de un viaje (un viaje puede tener varios) |
| `itineraries` | Itinerarios generados por IA, enlazados a un trip |
| `itinerary_nodes` | Nodos individuales del grafo: POI, restaurante, transporte, etc. |
| `expenses` | Gastos del viaje con categoría y moneda |
| `documents` | Documentos de viaje: pasaporte, reservas, seguros, etc. |
| `ai_usage` | Contador de mensajes de IA por usuario/mes para el límite del plan |

## Enums SQL a crear

```sql
-- Estado del viaje
CREATE TYPE trip_status AS ENUM ('planning', 'confirmed', 'active', 'completed', 'cancelled');

-- Estado del itinerario
CREATE TYPE itinerary_status AS ENUM ('draft', 'reviewing', 'approved', 'saved');

-- Tipo de nodo del itinerario
CREATE TYPE node_type AS ENUM (
  'poi', 'restaurant', 'transport', 'hotel_checkin',
  'activity', 'free_time', 'note', 'flight'
);

-- Estado del nodo según revisión del usuario
CREATE TYPE node_user_status AS ENUM ('pending', 'approved', 'rejected', 'modified');

-- Categoría de gasto
CREATE TYPE expense_category AS ENUM (
  'transport', 'accommodation', 'food', 'activities',
  'shopping', 'health', 'communication', 'other'
);

-- Tipo de documento
CREATE TYPE document_type AS ENUM (
  'passport', 'visa', 'flight', 'hotel', 'insurance',
  'car_rental', 'tour', 'other'
);

-- Plan del usuario
CREATE TYPE user_plan AS ENUM ('free', 'pro', 'team');
```

## Orden de migraciones

```
20260422_000001_create_enums.sql          ← enums primero (los usan las tablas)
20260422_000002_create_users.sql          ← tabla users (referenciada por todo)
20260422_000003_create_trips.sql          ← trips + destinations
20260422_000004_create_itineraries.sql    ← itineraries + itinerary_nodes
20260422_000005_create_expenses.sql       ← expenses
20260422_000006_create_documents.sql      ← documents
20260422_000007_create_ai_usage.sql       ← ai_usage
20260422_000008_create_rls_policies.sql   ← todas las políticas RLS juntas
```

## Reglas obligatorias para cada migración

1. **RLS habilitado desde la migración** — `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
2. **Soft delete** en `trips`, `itineraries`, `itinerary_nodes`, `expenses`, `documents`:
   ```sql
   deleted_at TIMESTAMPTZ DEFAULT NULL
   ```
3. **Políticas RLS mínimas** por tabla: SELECT, INSERT, UPDATE (no DELETE — soft delete)
4. **Todas las FKs** con `ON DELETE CASCADE` o `ON DELETE SET NULL` según corresponda
5. **`updated_at`** en todas las tablas con trigger automático

## Tipos TypeScript a completar en `packages/types/`

Los archivos ya existen como stubs. En esta fase se completan:

- `packages/types/user.ts` — `UserProfile`, `UserPlan`
- `packages/types/trip.ts` — `Trip`, `TripStatus`, `Destination`
- `packages/types/itinerary.ts` — `ItineraryGraph`, todos los tipos de nodo
- `packages/types/expense.ts` — `Expense`, `ExpenseCategory`
- `packages/types/document.ts` — `TravelDocument`, `DocumentType`
- `packages/types/database.ts` — **generado por Supabase CLI** (no editar manualmente)
- `packages/types/index.ts` — re-exporta todo

## Tareas

- [ ] Crear las 8 migraciones SQL en `supabase/migrations/`
- [ ] Completar tipos TypeScript en `packages/types/`
- [ ] Instalar Supabase CLI (`brew install supabase/tap/supabase`)
- [ ] Levantar Supabase local (`supabase start` — requiere Docker)
- [ ] Aplicar migraciones (`supabase db push` o `supabase db reset`)
- [ ] Generar tipos: `supabase gen types typescript --local > packages/types/database.ts`
- [ ] Verificar `pnpm typecheck` con 0 errores incluyendo `database.ts`
- [ ] Tests unitarios para los Zod schemas (`trip.schema.ts`, `itinerary.schema.ts`)

## Criterio de éxito

```bash
pnpm typecheck   # 0 errores — incluyendo packages/types/database.ts generado
pnpm test:run    # Todos los tests pasando, incluidos los de schemas Zod
supabase db diff # Sin diferencias (schema aplicado == migraciones)
```

Todas las tablas tienen RLS habilitado con políticas que restringen acceso al `auth.uid()` propietario.
`packages/types/database.ts` fue generado por CLI, no escrito a mano.
