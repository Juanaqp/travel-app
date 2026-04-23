# Fase 1 — Fundación del monorepo

## Estado: En progreso

## Objetivo
Configurar el monorepo base con todas las herramientas, dependencias y convenciones
necesarias para comenzar a desarrollar features sin deuda técnica desde el inicio.

## Tareas

- [x] Monorepo pnpm con workspaces: apps/mobile, packages/types, supabase/
- [x] Expo SDK 52 + Expo Router v4 configurado
- [x] NativeWind v4 configurado (global.css, tailwind.config.js, babel, metro)
- [x] Estructura de rutas: app/(auth)/ y app/(app)/(tabs)/
- [x] packages/types con tsconfig.json estricto
- [x] .gitignore completo (Expo, Node, Supabase, .env, .DS_Store)
- [x] apps/mobile/.env.local.example con todas las variables
- [x] GitHub Actions CI: install → typecheck → test:run
- [x] Vitest configurado con test de ejemplo pasando
- [x] lib/supabase.ts — cliente singleton con AsyncStorage
- [x] lib/logger.ts — wrapper de Sentry (TODO: conectar Sentry en Fase 9)
- [x] constants/theme.ts — design tokens base
- [x] supabase/config.toml — configuración local
- [x] Stubs de las 4 Edge Functions (implementación en fases 4-6)

## Notas técnicas

- **Expo Router v4** (no v3): Expo SDK 52 requiere Router 4.x — el CLAUDE.md dice v3 pero es un error
- Los layouts de Expo Router usan `export default` por requisito del framework (excepción a la regla de named exports)
- El logger usa `console.*` solo en modo dev hasta que Sentry se configure en Fase 9

## Próxima fase

**Fase 2 — Schema de base de datos**: Definir tipos TypeScript, migraciones SQL y RLS para las entidades principales (users, trips, itineraries, expenses, documents).
