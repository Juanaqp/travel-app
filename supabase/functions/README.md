# Edge Functions - TravelApp

Este directorio contiene las **Edge Functions** de Supabase para la aplicación TravelApp, una plataforma de gestión de viajes con IA generativa.

## 📋 Descripción General

Las Edge Functions son funciones serverless que se ejecutan en el edge de Supabase, escritas en **TypeScript** y ejecutadas con **Deno**. Proporcionan funcionalidades de backend como:

- Generación de itinerarios con IA (OpenAI GPT-4)
- Edición de nodos individuales del itinerario
- Procesamiento de documentos de viaje
- Análisis de gastos
- Gestión de cuentas de usuario

## 🏗️ Arquitectura

```
supabase/functions/
├── _shared/                    # Código compartido entre funciones
│   ├── errors.ts              # Manejo de errores estandarizado
│   └── rateLimiter.ts         # Control de límites de uso de IA
├── generate-itinerary/        # Generación de itinerarios con IA
│   └── index.ts
├── edit-node/                 # Edición de nodos del itinerario
│   └── index.ts
├── parse-document/            # Procesamiento de documentos
│   └── index.ts
├── parse-expense/             # Análisis de gastos
│   └── index.ts
└── delete-account/            # Eliminación de cuentas
    └── index.ts
```

## 🚀 Despliegue

### Despliegue Local

```bash
# Iniciar Supabase local
supabase start

# Desplegar todas las funciones
supabase functions deploy

# Desplegar función específica
supabase functions deploy generate-itinerary

# Ver logs en tiempo real
supabase functions logs
```

### Despliegue en Producción

```bash
# Desplegar a producción
supabase functions deploy --project-ref your-project-ref

# O usar CI/CD con GitHub Actions
```

## 🔧 Configuración

### Variables de Entorno

Configurar en Supabase Dashboard → Project Settings → Edge Functions:

```bash
# OpenAI (requerido para generate-itinerary)
OPENAI_API_KEY=sk-your-openai-api-key

# ElevenLabs (opcional para audioguías)
ELEVENLABS_API_KEY=your-elevenlabs-key

# Supabase (automático)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# APIs externas (opcional)
EXCHANGERATE_API_KEY=your-exchange-rate-key
FLIGHTAWARE_API_KEY=your-flightaware-key
```

### Configuración de Secrets

```bash
# Configurar secrets para producción
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ELEVENLABS_API_KEY=...

# Listar secrets configurados
supabase secrets list
```

## 📚 Funciones Disponibles

### 1. `generate-itinerary`

**Endpoint:** `POST /functions/v1/generate-itinerary`

Genera itinerarios completos usando OpenAI GPT-4. Incluye:
- Normalización de respuestas del modelo
- Validación con Zod schemas
- Reintentos automáticos
- Caché de 72 horas
- Control de límites de uso

**Request Body:**
```typescript
{
  userRequest: string,        // Descripción del viaje (10-500 chars)
  context: {
    tripId: string,           // UUID del viaje
    dates: {
      start: string,          // YYYY-MM-DD
      end: string             // YYYY-MM-DD
    },
    travelers: number,        // 1-20
    style: 'cultural' | 'adventure' | 'gastronomy' | 'relax' | 'luxury',
    pace: 'slow' | 'moderate' | 'intense',
    budget: 'budget' | 'mid' | 'premium' | 'luxury',
    hotel?: string,           // Alojamiento preferido
    mustInclude?: string[],   // Obligatorio incluir
    avoid?: string[],         // Evitar
    language: 'es' | 'en'     // Idioma de respuestas
  }
}
```

**Response:**
```typescript
{
  id: string,
  tripId: string,
  status: 'draft',
  generatedBy: 'gpt-4o-mini',
  userPrompt: string,
  days: ItineraryDay[],
  nodes: Record<string, ItineraryNode>,
  edges: ItineraryEdge[],
  meta: {
    totalDays: number,
    totalNodes: number,
    estimatedTotalCost?: number,
    currency?: string,
    generationDurationMs: number,
    version: string
  }
}
```

### 2. `edit-node`

**Endpoint:** `POST /functions/v1/edit-node`

Edita nodos individuales del itinerario sin regenerar todo el grafo.

### 3. `parse-document`

**Endpoint:** `POST /functions/v1/parse-document`

Procesa documentos de viaje (pasaportes, visas, reservas) usando IA.

### 4. `parse-expense`

**Endpoint:** `POST /functions/v1/parse-expense`

Analiza y categoriza gastos de viaje desde imágenes o texto.

### 5. `delete-account`

**Endpoint:** `POST /functions/v1/delete-account`

Elimina completamente la cuenta de usuario y todos sus datos.

## 🧪 Testing

### Tests Unitarios

```bash
# Ejecutar tests
pnpm test

# Tests específicos de funciones
pnpm test generate-itinerary.test.ts
```

### Tests de Integración

```bash
# Probar función localmente
supabase functions serve generate-itinerary

# Hacer request de prueba
curl -X POST 'http://localhost:54321/functions/v1/generate-itinerary' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{"userRequest": "Viaje a Paris", "context": {...}}'
```

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real

```bash
# Logs de todas las funciones
supabase functions logs

# Logs de función específica
supabase functions logs generate-itinerary

# Logs con filtro de tiempo
supabase functions logs --since 1h
```

### Métricas en Supabase Dashboard

- **Functions** → **Logs**: Ver ejecución y errores
- **Functions** → **Metrics**: Latencia y throughput
- **Database** → **Reports**: Uso de recursos

## 🔒 Seguridad

### Autenticación

Todas las funciones requieren autenticación JWT:
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) return errorResponse('UNAUTHORIZED', 'No autorizado', 401)
```

### Autorización

- **Row Level Security (RLS)** activado en todas las tablas
- Políticas de acceso basadas en `user_id`
- Soft delete para preservar integridad de datos

### Límites de Uso

- Control de rate limiting por usuario
- Límites de tokens de IA por mes
- Validación de entrada con Zod schemas

## 🐛 Debugging

### Errores Comunes

1. **OPENAI_API_KEY no configurada**
   ```
   Error: OPENAI_API_KEY no configurada
   Solución: supabase secrets set OPENAI_API_KEY=sk-...
   ```

2. **Timeout en generación**
   ```
   Error: Timeout: el servicio de IA tardó demasiado
   Solución: Reducir duración del viaje o aumentar timeout
   ```

3. **Schema validation error**
   ```
   Error: El itinerario generado no cumple el schema
   Solución: Revisar logs detallados de validación Zod
   ```

### Debug Mode

Agregar logs temporales:
```typescript
console.log('[DEBUG] Variable:', variable)
```

## 📈 Optimización

### Rendimiento

- **Caché**: 72 horas para itinerarios similares
- **Compresión**: Respuestas JSON optimizadas
- **Timeouts**: Configurados por función (300-900s)

### Costos

- **OpenAI**: ~$0.01 por itinerario generado
- **Supabase**: $0.0001 por invocación
- **Rate limiting**: Previene abuso y costos excesivos

## 🤝 Contribución

### Desarrollo Local

1. **Clonar repositorio**
2. **Instalar dependencias**: `pnpm install`
3. **Configurar Supabase**: `supabase start`
4. **Desarrollar**: Modificar funciones en `supabase/functions/`
5. **Testear**: `pnpm test`
6. **Desplegar**: `supabase functions deploy`

### Convenciones de Código

- **Imports**: Usar `npm:` para Deno compatibility
- **Logging**: `console.log` (no `logger.ts` en Edge Functions)
- **Errores**: Usar `errorResponse()` del shared module
- **Validación**: Zod schemas para todas las entradas

## 📝 Notas de Versión

### v2.1.0
- ✅ Schema de itinerario actualizado
- ✅ Normalización mejorada de respuestas OpenAI
- ✅ Reintentos inteligentes con corrección
- ✅ Caché de itinerarios

### Próximas Features
- 🔄 Audioguías con ElevenLabs
- 🔄 Integración con APIs de vuelos/hoteles
- 🔄 Itinerarios multi-idioma
- 🔄 Optimización de costos

---

**TravelApp** - Gestiona tus viajes con IA 🤖✈️