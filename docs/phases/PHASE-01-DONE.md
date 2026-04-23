# Fase 1 — Fundación del monorepo

## Estado: ✅ COMPLETADA (2026-04-22)

## Objetivo

Configurar el monorepo base con todas las herramientas, dependencias y convenciones
necesarias para comenzar a desarrollar features sin deuda técnica desde el inicio.

## Qué se construyó

### Monorepo pnpm
- `pnpm-workspace.yaml` con workspaces: `apps/*` y `packages/*`
- `package.json` raíz con scripts delegados a cada workspace
- `.npmrc` con `public-hoist-pattern` para `@babel/runtime` y `react-native-css-interop` (necesario para que Metro resuelva dependencias transitivas en pnpm)

### App Expo (`apps/mobile/`)
- Expo SDK 52 + React 18.3.1 + React Native 0.76.9
- Expo Router v4 con estructura de rutas completa:
  - `app/_layout.tsx` — root layout con `QueryClientProvider`
  - `app/(auth)/index.tsx` — pantalla de login (Magic Link, Fase 3)
  - `app/(app)/_layout.tsx` — protección de ruta con `supabase.auth`
  - `app/(app)/(tabs)/` — 4 tabs: index, explore, documents, profile
- NativeWind 4.1.23 configurado: `global.css`, `tailwind.config.js`, `babel.config.js`, `metro.config.js`
- TanStack Query v5 configurado en root layout
- `lib/supabase.ts` — cliente singleton SSR-safe con AsyncStorage
- `lib/logger.ts` — wrapper con prefijo `[TravelApp]`, stub de Sentry para prod
- `constants/theme.ts` — design tokens (colores, spacing, radii)

### Paquete de tipos (`packages/types/`)
- `tsconfig.json` en modo estricto
- Tipos base: `trip.ts`, `itinerary.ts`, `expense.ts`, `document.ts`, `user.ts`
- Schemas Zod: `schemas/trip.schema.ts`, `schemas/itinerary.schema.ts`
- `index.ts` con re-exportación de todo

### Supabase (`supabase/`)
- `config.toml` con auth Magic Link, JWT 3600s, deep link `travelapp://`
- Carpetas `migrations/` y `functions/` creadas
- Stubs de las 4 Edge Functions: `generate-itinerary`, `edit-node`, `parse-document`, `parse-expense`

### CI/CD
- `.github/workflows/ci.yml` — GitHub Actions: `pnpm install → typecheck → test:run`
- `.gitignore` completo para Expo, Node, Supabase, `.env*`, `.DS_Store`
- `apps/mobile/.env.local.example` con todas las variables documentadas

### Tests
- Vitest v2 configurado con `vitest.config.ts` y `vitest.setup.ts`
- `__tests__/example.test.ts` — 2 tests de configuración básica
- `__tests__/setup.test.ts` — 2 tests: cliente Supabase y logger

## Patrones establecidos

### NativeWind
```tsx
// ✅ Siempre className — nunca StyleSheet.create
<View className="flex-1 bg-slate-900 px-4 py-6">
  <Text className="text-xl font-semibold text-white">Mis Viajes</Text>
</View>
```

### Cliente Supabase
```typescript
// ✅ Siempre desde lib/supabase.ts — nunca crear cliente inline
import { supabase } from '@/lib/supabase'
```

### Logger
```typescript
// ✅ Siempre logger — nunca console.log directo
import { logger } from '@/lib/logger'
logger.info('Viaje creado', { tripId, userId })
logger.error('Fallo al guardar', { error, tripId })
```

### Tests con mocks nativos
```typescript
// Patrón para testear módulos que usan react-native o AsyncStorage en Vitest:
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { ... } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: {} })) }))
```

### Expo Router — excepción a named exports
```typescript
// Los archivos de layout/screen de Expo Router DEBEN usar export default
// (requisito del framework — excepción a la regla general de named exports)
export default function RootLayout() { ... }
```

## Decisiones técnicas y problemas resueltos

| Problema | Solución |
|---|---|
| Expo SDK 52 requiere Router v4, no v3 | Usar `expo-router: ~4.0.17` |
| `react@18.3.2` no existe en npm | Usar `react: 18.3.1` |
| NativeWind 4.2.x requiere `react-native-worklets` incompatible con RN 0.76 | Pinear a `nativewind: 4.1.23` |
| Metro no resuelve dependencias transitivas en pnpm | `public-hoist-pattern` en `.npmrc` + declarar como deps directas |
| `window is not defined` en SSR de Expo Router | Detectar SSR con `Platform.OS === 'web' && typeof window === 'undefined'` |
| `npx expo` descarga versión global incorrecta | Usar `apps/mobile/node_modules/.bin/expo` directamente |

## Comandos de verificación que pasaron

```bash
pnpm typecheck   # 0 errores TypeScript
pnpm test:run    # 4 tests pasando (2 example + 2 setup)
# Web: localhost:8081 devuelve HTTP 200 con bundle correcto (861 módulos SSR, 910+ cliente)
```

## Próxima fase

**Fase 2 — Schema de base de datos**: Tipos TypeScript completos, migraciones SQL con RLS,
y generación de tipos desde Supabase CLI.
