# ARCHITECTURE.md — Decisiones de arquitectura

## Monorepo

- **pnpm workspaces** con tres workspaces: `apps/mobile`, `packages/types`, `supabase/`
- Tipos compartidos en `packages/types` — fuente de verdad, nunca inline en la app

## Expo SDK 52

- **Expo Router v4** (no v3 — SDK 52 requiere Router 4.x)
- Rutas basadas en archivos: `(auth)/` para login, `(app)/(tabs)/` para la app principal
- `app.config.ts` — configuración dinámica leyendo variables de entorno

## Estilos

- **NativeWind v4** sobre React Native — clases Tailwind, layout Flexbox nativo
- Design tokens en `constants/theme.ts`

## Estado

- **Zustand v5** para estado global de UI (sesión, tema, UI state)
- **TanStack Query v5** para estado de servidor — caché, loading, errores automáticos

## Backend

- **Supabase** como BaaS: PostgreSQL 15 + Auth + Storage + Edge Functions
- Row Level Security habilitado en todas las tablas
- Soft delete con columna `deleted_at` en lugar de DELETE físico
- Migraciones SQL versionadas en `supabase/migrations/`

## IA

- **OpenAI (GPT-4o-mini)** para generación de itinerarios, edición de nodos y parsing de documentos/gastos
- API Key solo en Edge Functions (Deno), nunca en el cliente
- Reintentos automáticos con backoff exponencial

## Tests

- **Vitest v2** para lógica de negocio (unit tests)
- **Maestro** para E2E (fase posterior)
