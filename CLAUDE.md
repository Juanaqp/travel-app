# TravelApp — CLAUDE.md
# LEER ESTE ARCHIVO COMPLETO AL INICIO DE CADA SESIÓN SIN EXCEPCIÓN
# Este archivo es la memoria del proyecto. Sin leerlo, el código generado será inconsistente.

---

## Descripción del proyecto

App de gestión de viajes con IA generativa. MVP en español para el usuario final.
Un solo desarrollador. Stack TypeScript de punta a punta.
Objetivo: MVP en 10 fases, ~30 días de desarrollo activo.

---

## Reglas de idioma — OBLIGATORIAS

```
CÓDIGO:        inglés  → variables, funciones, clases, tipos, constantes, archivos, carpetas
COMENTARIOS:   español → explicaciones, JSDoc, comentarios inline, TODOs
UI / UX:       español → textos visibles al usuario, labels, mensajes, placeholders
DOCS:          español → este archivo, READMEs, docs/phases/, commits (pueden ir en inglés)
```

### Ejemplos correctos

```typescript
// Obtiene la lista de viajes activos del usuario actual
const fetchUserTrips = async (userId: string): Promise<Trip[]> => { ... }

// Calcula el gasto total convertido a la moneda base del usuario
const calculateTotalExpense = (expenses: Expense[], baseCurrency: string): number => { ... }

// Estado del formulario de creación de viaje
const [isSubmitting, setIsSubmitting] = useState(false)

// Texto visible al usuario — en español
const EMPTY_STATE_TITLE = 'Aún no tienes viajes'
const EMPTY_STATE_SUBTITLE = 'Crea tu primer viaje y planifícalo con IA'
```

### Ejemplos incorrectos — NUNCA hacer esto

```typescript
// ❌ Variable en español
const obtenerViajes = async () => { ... }

// ❌ Comentario en inglés cuando hay español disponible
// Get user trips from database
const fetchTrips = async () => { ... }

// ❌ Tipo en español
interface Viaje { ... }
```

---

## Stack tecnológico exacto — no usar versiones distintas sin consultar

| Capa | Tecnología | Versión |
|---|---|---|
| Framework mobile/web | Expo SDK | 52 (~52.0.0) |
| Router | Expo Router | v4 (~4.0.17) — SDK 52 requiere v4, no v3 |
| React | React | 18.3.1 — 18.3.2 no existe en npm |
| Lenguaje | TypeScript | 5 (modo estricto) |
| Estilos | NativeWind | 4.1.23 — 4.2.x requiere react-native-worklets incompatible con RN 0.76 |
| Estado global UI | Zustand | v5 |
| Estado servidor / caché | TanStack Query (React Query) | v5 |
| Backend | Supabase JS SDK | v2 |
| Base de datos | PostgreSQL | 15 (via Supabase) |
| Auth | Supabase Auth | — |
| Storage | Supabase Storage | — |
| Edge Functions | Deno + TypeScript | 1.x |
| Validación | Zod | v3 |
| Tests unitarios | Vitest | v2 |
| Tests E2E | Maestro | — |
| Analytics | PostHog | — |
| Errores | Sentry | — |
| Gestor de paquetes | pnpm | workspaces |

---

## Comandos del proyecto

```bash
# Desarrollo
pnpm dev              # Expo en modo desarrollo (hot reload)
pnpm ios              # Abre simulador iOS (requiere Xcode)
pnpm android          # Abre emulador Android
pnpm web              # Versión web en localhost:8081

# Calidad de código
pnpm test             # Vitest en modo watch
pnpm test:run         # Vitest una pasada (para CI)
pnpm typecheck        # tsc --noEmit, verifica tipos sin compilar
pnpm lint             # ESLint en todo el proyecto

# Supabase
supabase start        # Levanta stack local completo (requiere Docker)
supabase stop         # Detiene el stack local
supabase db push      # Aplica migraciones pendientes (local y remoto)
supabase db reset     # Resetea BD local y re-aplica todas las migraciones
supabase db diff      # Muestra diferencias entre schema actual y migraciones
supabase gen types typescript --local > packages/types/database.ts
supabase functions serve <nombre>   # Sirve una Edge Function localmente
supabase secrets set KEY=value      # Configura secretos para Edge Functions

# Deploy
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
vercel deploy --prod  # Web
```

---

## Estructura del repositorio — respetar siempre

```
travel-app/
├── CLAUDE.md                          ← este archivo — leer siempre primero
├── ARCHITECTURE.md                    ← decisiones de arquitectura tomadas
├── package.json                       ← scripts raíz del monorepo
├── pnpm-workspace.yaml                ← define los workspaces
│
├── docs/
│   └── phases/
│       ├── PHASE-01-DONE.md           ← fases completadas
│       ├── PHASE-02-DONE.md
│       └── PHASE-XX-ACTIVE.md         ← fase actual (leer junto con CLAUDE.md)
│
├── apps/
│   └── mobile/                        ← única app Expo (iOS + Android + Web)
│       ├── app/                       ← Expo Router — estructura = rutas
│       │   ├── _layout.tsx            ← root layout: providers globales
│       │   ├── (auth)/
│       │   │   └── index.tsx          ← pantalla de login (Magic Link)
│       │   └── (app)/
│       │       ├── _layout.tsx        ← protección de ruta: redirige si sin sesión
│       │       └── (tabs)/
│       │           ├── _layout.tsx    ← tab bar: 4 tabs principales
│       │           ├── index.tsx      ← tab Mis Viajes
│       │           ├── explore.tsx    ← tab Explorar
│       │           ├── documents.tsx  ← tab Documentos
│       │           └── profile.tsx    ← tab Perfil
│       ├── components/                ← componentes UI reutilizables
│       ├── hooks/                     ← custom hooks (prefijo use obligatorio)
│       ├── stores/                    ← Zustand stores (sufijo Store)
│       ├── lib/
│       │   ├── supabase.ts            ← cliente Supabase — único en el proyecto
│       │   ├── logger.ts              ← wrapper de Sentry — nunca console.log
│       │   └── notifications.ts       ← Expo Push Notifications
│       ├── constants/
│       │   └── theme.ts               ← design tokens: colores, spacing, radii
│       └── __tests__/                 ← tests junto al código que prueban
│
├── supabase/
│   ├── config.toml                    ← config del proyecto Supabase
│   ├── migrations/                    ← SQL numerado: YYYYMMDDHHmmss_nombre.sql (14 dígitos)
│   │   ├── 20260422000001_create_enums.sql
│   │   ├── 20260422000002_create_users.sql
│   │   └── ...
│   └── functions/                     ← Edge Functions: una carpeta por función
│       ├── generate-itinerary/
│       │   └── index.ts
│       ├── edit-node/
│       │   └── index.ts
│       ├── parse-document/
│       │   └── index.ts
│       └── parse-expense/
│           └── index.ts
│
└── packages/
    └── types/                         ← tipos TypeScript compartidos (FUENTE DE VERDAD)
        ├── itinerary.ts               ← ItineraryGraph, ItineraryNode, ItineraryEdge
        ├── trip.ts                    ← Trip, TripStatus, Destination
        ├── expense.ts                 ← Expense, ExpenseCategory
        ├── document.ts                ← TravelDocument, DocumentType
        ├── user.ts                    ← UserProfile, UserPlan
        ├── database.ts                ← generado por Supabase CLI (no editar manualmente)
        ├── schemas/
        │   ├── itinerary.schema.ts    ← Zod schema para ItineraryGraph
        │   └── trip.schema.ts         ← Zod schema para CreateTripInput
        └── index.ts                   ← re-exporta todo
```

---

## Convenciones de código — aplicar siempre

### Nombrado

```
Archivos y carpetas:    kebab-case          → user-profile.tsx, use-trips.ts
Componentes React:      PascalCase          → TripCard, ItineraryNodeCard
Custom hooks:           camelCase + use     → useTrips, useAuthStore
Zustand stores:         camelCase + Store   → useAuthStore, useItineraryStore
Edge Functions:         kebab-case          → generate-itinerary, parse-expense
Migraciones SQL:        YYYYMMDD_HHmmss_descripcion.sql
Constantes:             UPPER_SNAKE_CASE    → MAX_AI_MESSAGES_PER_MONTH
Tipos e interfaces:     PascalCase          → Trip, ItineraryNode, UserProfile
Enums:                  PascalCase          → TripStatus, ExpenseCategory
```

### Exports

```typescript
// ✅ Siempre named exports en componentes
export const TripCard = ({ trip }: TripCardProps) => { ... }
export const useTrips = () => { ... }

// ❌ Nunca default export en componentes o hooks
export default TripCard  // NO
```

### TypeScript estricto

```typescript
// tsconfig.json tiene "strict": true — estas reglas aplican:
// - No any implícito
// - No null no verificado
// - Propiedades de clase inicializadas

// ✅ Correcto
const getUserById = async (id: string): Promise<User | null> => { ... }

// ❌ Incorrecto — any nunca
const processData = (data: any) => { ... }

// ✅ Correcto — usar unknown si el tipo es realmente desconocido
const processData = (data: unknown) => {
  if (!isValidData(data)) throw new Error('Datos inválidos')
  // ...
}
```

---

## Patrones de código establecidos — seguir siempre

### Data fetching — React Query (NUNCA useEffect para fetch)

```typescript
// ✅ Correcto — React Query maneja caché, loading, error automáticamente
const { data: trips, isLoading, error } = useQuery({
  queryKey: ['trips', userId],
  queryFn: () => fetchUserTrips(userId),
  staleTime: 5 * 60 * 1000,  // 5 minutos antes de refetch
  retry: 2,
})

const createTripMutation = useMutation({
  mutationFn: (input: CreateTripInput) => createTrip(input),
  onSuccess: () => {
    // Invalida el caché para refrescar la lista
    queryClient.invalidateQueries({ queryKey: ['trips'] })
  },
  onError: (error) => {
    logger.error('Error al crear viaje', { error })
  },
})

// ❌ Incorrecto — nunca useEffect para fetch
useEffect(() => {
  fetch('/api/trips').then(...)  // NO
}, [])
```

### Cliente Supabase — siempre desde lib/supabase.ts

```typescript
// ✅ Correcto — importar el cliente singleton
import { supabase } from '@/lib/supabase'

const fetchTrips = async (userId: string): Promise<Trip[]> => {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)  // Siempre filtrar soft delete
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Error al obtener viajes', { error, userId })
    throw error
  }

  return data ?? []
}

// ❌ Incorrecto — nunca crear cliente nuevo inline
const client = createClient(url, key)  // NO
```

### Manejo de errores — nunca silenciar, siempre loggear

```typescript
// ✅ Correcto — error tipado, loggeado, relanzado o manejado
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  // Loggear con contexto suficiente para debuggear
  logger.error('Descripción de qué falló', {
    error,
    context: { userId, tripId },
    operation: 'riskyOperation',
  })
  // Relanzar si el caller debe manejar el error
  throw error
}

// ❌ Incorrecto — nunca silenciar errores
try {
  await riskyOperation()
} catch {
  // silencio total — NUNCA
}

// ❌ Incorrecto — console.log en lugar de logger
console.log('Error:', error)  // NO — usar logger.error
```

### Logger — nunca console.log directo

```typescript
// ✅ Correcto — siempre el logger tipado
import { logger } from '@/lib/logger'

logger.info('Viaje creado exitosamente', { tripId, userId })
logger.warn('Límite de IA al 80%', { userId, msgsUsed, limit })
logger.error('Fallo al generar itinerario', { error, prompt, attempt })
logger.debug('Respuesta de la Edge Function', { response })  // Solo en dev

// ❌ Incorrecto
console.log('Trip created')
console.error('Error:', err)
```

### Estilos — NativeWind siempre, StyleSheet solo si es inevitable

```typescript
// ✅ Correcto — NativeWind con clases Tailwind
<View className="flex-1 bg-slate-900 px-4 py-6">
  <Text className="text-xl font-semibold text-white">
    Mis Viajes
  </Text>
  <Pressable className="mt-4 rounded-lg bg-indigo-500 p-3 active:bg-indigo-600">
    <Text className="text-center font-medium text-white">
      Crear viaje
    </Text>
  </Pressable>
</View>

// ❌ Incorrecto — StyleSheet.create (solo si NativeWind no puede hacer algo)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' }  // Evitar
})
```

### Tipos — siempre de packages/types, nunca inline

```typescript
// ✅ Correcto
import type { Trip, CreateTripInput, TripStatus } from '@/../../packages/types'
// o con path alias configurado:
import type { Trip } from '@types'

// ❌ Incorrecto — tipo definido inline en el componente
interface Trip {  // NO — ya existe en packages/types/trip.ts
  id: string
  title: string
}
```

### Soft delete — nunca DELETE real en el MVP

```typescript
// ✅ Correcto — soft delete actualizando deleted_at
const archiveTrip = async (tripId: string): Promise<void> => {
  const { error } = await supabase
    .from('trips')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tripId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)

  if (error) throw error
}

// Siempre filtrar registros con soft delete en queries
const { data } = await supabase
  .from('trips')
  .select('*')
  .is('deleted_at', null)  // ← obligatorio en toda query de lista

// ❌ Incorrecto — borrado físico
await supabase.from('trips').delete().eq('id', tripId)  // NO
```

---

## Reglas de robustez — código de producción desde el día 1

### 1. Validación de entradas siempre

```typescript
// ✅ Toda Edge Function valida el body con Zod antes de procesarlo
import { z } from 'zod'

const generateItinerarySchema = z.object({
  userRequest: z.string().min(10).max(500),
  context: z.object({
    dates: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    travelers: z.number().int().min(1).max(20),
    style: z.enum(['cultural', 'adventure', 'gastronomy', 'relax', 'luxury']),
    pace: z.enum(['slow', 'moderate', 'intense']),
    budget: z.enum(['budget', 'mid', 'premium']),
    language: z.enum(['es', 'en']).default('es'),
  }),
})

// En la Edge Function:
const parseResult = generateItinerarySchema.safeParse(await req.json())
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ error: 'Datos inválidos', details: parseResult.error.flatten() }),
    { status: 422 }
  )
}
```

### 2. Row Level Security en TODAS las tablas — sin excepciones

```sql
-- Ejemplo de política RLS correcta — aplicar en cada tabla
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Solo el propietario puede ver sus viajes
CREATE POLICY "users_select_own_trips"
  ON trips FOR SELECT
  USING (user_id = auth.uid());

-- Solo el propietario puede insertar con su propio user_id
CREATE POLICY "users_insert_own_trips"
  ON trips FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Solo el propietario puede actualizar sus viajes
CREATE POLICY "users_update_own_trips"
  ON trips FOR UPDATE
  USING (user_id = auth.uid());

-- Sin política de DELETE — se usa soft delete
```

### 3. Reintentos automáticos en llamadas a LLMs

```typescript
// ✅ Patrón de reintento para llamadas a la API de Gemini
const callGeminiWithRetry = async (
  apiKey: string,
  prompt: string,
  maxAttempts: number = 2
): Promise<string> => {
  let lastError: Error | null = null
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      })
      const data = await res.json()
      return data.candidates[0].content.parts[0].text
    } catch (error) {
      lastError = error as Error
      logger.warn(`Intento ${attempt}/${maxAttempts} fallido`, { error })

      // Esperar antes de reintentar (backoff exponencial)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      }
    }
  }

  throw new Error(`API de Gemini falló después de ${maxAttempts} intentos: ${lastError?.message}`)
}
```

### 4. Timeouts explícitos en operaciones largas

```typescript
// ✅ Siempre definir timeout para operaciones de red
const FETCH_TIMEOUT_MS = 20_000  // 20 segundos

const fetchWithTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout: operación demasiado lenta')), timeoutMs)
  )
  return Promise.race([operation(), timeoutPromise])
}
```

### 5. Estado de carga y error en TODA operación asíncrona

```typescript
// ✅ Siempre manejar los 3 estados: loading, error, success
const TripListScreen = () => {
  const { data: trips, isLoading, error, refetch } = useTrips()

  // Estado de carga
  if (isLoading) return <LoadingSkeleton count={3} />

  // Estado de error con opción de reintentar
  if (error) return (
    <ErrorState
      message="No pudimos cargar tus viajes"
      onRetry={refetch}
    />
  )

  // Estado vacío con call-to-action
  if (!trips?.length) return (
    <EmptyState
      title="Aún no tienes viajes"
      subtitle="Crea tu primer viaje y planifícalo con IA"
      actionLabel="Crear primer viaje"
      onAction={() => router.push('/trips/new')}
    />
  )

  // Estado con datos
  return <FlatList data={trips} renderItem={renderTrip} />
}
```

### 6. Verificar autenticación antes de cualquier operación

```typescript
// ✅ Helper para obtener el usuario autenticado con verificación
const getAuthenticatedUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Usuario no autenticado')
  }

  return user
}

// Usar en cada hook que acceda a datos del usuario
const useCreateTrip = () => {
  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const user = await getAuthenticatedUser()
      return createTrip({ ...input, userId: user.id })
    },
  })
}
```

### 7. Tests para toda lógica de negocio crítica

```typescript
// ✅ Tests deben cubrir: caso exitoso, caso de error, y casos edge
describe('useTrips', () => {
  // Caso exitoso
  it('debe retornar viajes del usuario activos (sin soft delete)', async () => {
    const trips = await fetchUserTrips('user-123')
    expect(trips.every(t => t.deletedAt === null)).toBe(true)
  })

  // Caso de error
  it('debe lanzar error si Supabase falla', async () => {
    mockSupabase.from.mockRejectedValue(new Error('DB error'))
    await expect(fetchUserTrips('user-123')).rejects.toThrow('DB error')
  })

  // Caso edge
  it('debe retornar array vacío si el usuario no tiene viajes', async () => {
    mockSupabase.from.mockResolvedValue({ data: [], error: null })
    const trips = await fetchUserTrips('user-nuevo')
    expect(trips).toEqual([])
  })
})
```

### 8. Datos sensibles nunca en el cliente

```typescript
// ✅ Variables de entorno para el cliente (públicas, sin secretos)
EXPO_PUBLIC_SUPABASE_URL=        // URL pública — seguro exponer
EXPO_PUBLIC_SUPABASE_ANON_KEY=   // Anon key — seguro exponer (RLS protege)
EXPO_PUBLIC_POSTHOG_KEY=         // Analytics — seguro exponer

// ✅ Variables solo en Edge Functions (servidor — nunca en el cliente)
GEMINI_API_KEY=                  // ← NUNCA en código del cliente
SUPABASE_SERVICE_ROLE_KEY=       // ← NUNCA en código del cliente
ELEVENLABS_API_KEY=              // ← NUNCA en código del cliente

// ❌ Nunca hardcodear claves
const apiKey = 'AIzaSyXXXXXXXX'  // NUNCA — usar Deno.env.get('GEMINI_API_KEY')
```

---

## Schema del itinerario — el contrato central del sistema

```typescript
// packages/types/itinerary.ts — estructura completa
// Los nodos son independientes: se editan uno a uno, nunca el grafo completo
// El itinerario NO se guarda en BD hasta que status === 'approved'

interface ItineraryGraph {
  id: string
  tripId: string
  status: 'draft' | 'reviewing' | 'approved' | 'saved'
  generatedBy: string        // modelo LLM usado: 'gemini-2.0-flash'
  userPrompt: string         // prompt original del usuario
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>  // mapa nodeId → nodo
  edges: ItineraryEdge[]
  meta: ItineraryMeta
}

// Discriminated union por type — Claude genera exactamente este schema
type ItineraryNode =
  | PoiNode
  | RestaurantNode
  | TransportNode
  | HotelCheckinNode
  | ActivityNode
  | FreeTimeNode
  | NoteNode
  | FlightNode

// Campos comunes a todos los tipos
interface BaseNode {
  id: string
  type: NodeType
  dayId: string
  order: number
  time: string              // 'HH:mm' en hora local del destino
  durationMinutes: number
  endTime: string           // calculado: time + durationMinutes
  name: string
  description: string
  emoji: string
  aiTip: string             // consejo práctico de Gemini
  location: NodeLocation
  cost: NodeCost
  userStatus: 'pending' | 'approved' | 'rejected' | 'modified'
  isAiGenerated: boolean
  isUserModified: boolean
  createdAt: string
}
```

---

## Variables de entorno

### Cliente Expo (apps/mobile/.env.local)

```bash
# Supabase — valores del proyecto en supabase.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Analytics y monitoreo
EXPO_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Mapas
EXPO_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...  # Solo si se usa Mapbox en lugar de expo-maps
```

### Edge Functions (supabase/.env o via `supabase secrets set`)

```bash
# IA — solo en servidor, NUNCA en cliente
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXX
ELEVENLABS_API_KEY=sk_xxxxx            # Para audioguías en V1

# Supabase admin — solo en servidor
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# APIs externas
EXCHANGERATE_API_KEY=xxxxx             # Conversión de moneda
FLIGHTAWARE_API_KEY=xxxxx             # Estado de vuelos
```

---

## Reglas absolutas — NUNCA violar

```
PROHIBIDO:  Tipos TypeScript inline — siempre usar packages/types/
PROHIBIDO:  fetch() directo — siempre el cliente Supabase o SDK del LLM
PROHIBIDO:  useEffect para data fetching — usar React Query
PROHIBIDO:  console.log, console.error — usar logger.ts
PROHIBIDO:  Editar schema de BD en el dashboard — solo via migraciones SQL
PROHIBIDO:  Secretos en variables EXPO_PUBLIC_ o en código fuente
PROHIBIDO:  Guardar itinerario en BD mientras status !== 'approved'
PROHIBIDO:  Crear cliente Supabase fuera de lib/supabase.ts
PROHIBIDO:  DELETE físico en tablas con soft delete — usar deleted_at
PROHIBIDO:  any en TypeScript — usar unknown con type guards si es necesario
PROHIBIDO:  Nombres de variables/funciones en español — inglés siempre
PROHIBIDO:  Tablas sin RLS habilitado — activar en todas las tablas
PROHIBIDO:  Omitir manejo de errores — siempre try/catch con logger
PROHIBIDO:  Código sin types en props de componentes — siempre definir interface
PROHIBIDO:  Modificar packages/types/database.ts manualmente — generado por Supabase CLI
```

---

## Checklist antes de considerar una tarea terminada

Antes de decir "listo" en cualquier tarea, verificar:

```
[ ] pnpm typecheck pasa con 0 errores
[ ] pnpm test:run pasa con 0 failures
[ ] No hay console.log ni console.error en el código nuevo
[ ] Todos los tipos vienen de packages/types/ (ninguno inline)
[ ] Todos los errores tienen logger.error con contexto
[ ] Los estados de loading y error están manejados en la UI
[ ] Las variables y funciones tienen nombres en inglés
[ ] Los comentarios explicativos están en español
[ ] Si hay acceso a BD: se filtra deleted_at en queries de lista
[ ] Si hay nueva tabla: RLS está habilitado con policies
[ ] Si hay Edge Function: valida el body de entrada con Zod
```

---

## Patrones establecidos por fase — actualizar al completar cada fase

### Fase 1 — Fundación ✅ COMPLETADA (2026-04-22)
- NativeWind v4: usar `className` en todos los componentes, no StyleSheet.create
- Supabase: importar siempre de `@/lib/supabase`, nunca crear cliente nuevo
- Logger: nunca console.log directo, siempre `logger.info/warn/error`
- Tests: en `__tests__/` junto al código que prueban
- Expo Router: usar `export default` solo en archivos de layout/screen requeridos por el framework (excepción a la regla de named exports)
- pnpm + Metro: `react-native-css-interop` y `@babel/runtime` declarados como deps directas de `apps/mobile` — Metro no resuelve transitivas en pnpm
- `.npmrc` raíz con `public-hoist-pattern` para `@babel/runtime` y `react-native-css-interop`
- `lib/supabase.ts`: SSR-safe — detectar `isSSR` con `Platform.OS === 'web' && typeof window === 'undefined'`; usar `storage: undefined` en SSR para evitar `window is not defined`

### Fase 2 — Schema de base de datos 🔄 EN PROGRESO
- Tipos de BD: generados con `supabase gen types typescript --local > packages/types/database.ts`
- Migraciones: en `supabase/migrations/` con formato `YYYYMMDDHHmmss_descripcion.sql` (14 dígitos sin guion)
- RLS: activado desde la migración (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`) — nunca como paso posterior
- Soft delete: columna `deleted_at TIMESTAMPTZ DEFAULT NULL` en trips, itineraries, itinerary_nodes, expenses, documents
- Enums SQL: crear en migración `000001_create_enums.sql` antes que las tablas que los usan
- `packages/types/database.ts`: NUNCA editar manualmente — siempre generado por CLI

### Fases siguientes
<!-- Actualizar aquí al completar cada fase -->

---

## Analogías útiles para el desarrollador (C#/Vue → React Native)

| Concepto React Native | Equivalente C# / Vue |
|---|---|
| Zustand store | Pinia store (más simple, sin getters/actions separados) |
| React Query | Repositorio con caché automático + estados loading/error built-in |
| Expo Router | Vue Router basado en archivos (como Next.js App Router) |
| Edge Function (Deno) | Controller de ASP.NET Core (sin inyección de dependencias) |
| NativeWind | Tailwind CSS (mismas clases, layout Flexbox obligatorio) |
| View / Text | div / span (no existe HTML en React Native) |
| Pressable | button clickable (con estados pressed/hover) |
| FlatList | v-for virtualizado (renderiza solo lo visible) |
| useMemo | computed property de Vue |
| useCallback | método de clase (referencia estable) |

---

## Fase actual del proyecto

**VER: `docs/phases/PHASE-02-ACTIVE.md` para el contexto específico de la sesión actual.**

Al iniciar cada sesión con Claude Code:
1. Leer este CLAUDE.md completo
2. Leer el archivo PHASE-XX-ACTIVE.md de la fase actual
3. Solo entonces comenzar a escribir código

---

*Última actualización: 2026-04-22 — Fase 2 iniciada (schema + tipos)*
*Versión del schema de itinerario: 2.1.0*
