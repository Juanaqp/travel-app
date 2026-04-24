// Edge Function: generate-itinerary
// POST /functions/v1/generate-itinerary
// Genera el itinerario inicial con Mistral AI para un viaje dado.
// Incluye caché de 72h, reintentos automáticos y registro de uso.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIMEOUT_MS = 120_000  // Aumentado a 2 minutos para dar más tiempo a la IA
const MAX_RETRIES = 3
const CACHE_TTL_HOURS = 72
const MODEL = 'mistral-small-latest'
const MAX_TOKENS = 8000
const SCHEMA_VERSION = '2.1.0'
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

// ─── Schema de entrada ────────────────────────────────────────────────────────

const requestSchema = z.object({
  userRequest: z.string().min(10).max(500),
  context: z.object({
    tripId: z.string().uuid(),
    dates: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    travelers: z.number().int().min(1).max(20),
    style: z.enum(['cultural', 'adventure', 'gastronomy', 'relax', 'luxury']),
    pace: z.enum(['slow', 'moderate', 'intense']),
    budget: z.enum(['budget', 'mid', 'premium', 'luxury']),
    hotel: z.string().optional(),
    mustInclude: z.array(z.string()).optional(),
    avoid: z.array(z.string()).optional(),
    language: z.enum(['es', 'en']).default('es'),
  }),
})

type RequestBody = z.infer<typeof requestSchema>
type RequestContext = RequestBody['context']

// ─── Schema Zod del ItineraryGraph (inline para Deno) ────────────────────────
// Espejo del schema en packages/types/schemas/itinerary.schema.ts

const timeRe = /^\d{2}:\d{2}$/
const dateRe = /^\d{4}-\d{2}-\d{2}$/

const nodeCostSchema = z.object({
  amount: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  isIncluded: z.boolean().optional(),
})

const nodeLocationSchema = z.object({
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
})

const baseNodeSchema = z.object({
  id: z.string().min(1),
  dayId: z.string().min(1),
  order: z.number().int().min(0),
  time: z.string().regex(timeRe),
  durationMinutes: z.number().int().min(1),
  endTime: z.string().regex(timeRe),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  emoji: z.string().max(10).default('📍'),
  aiTip: z.string().max(500).default(''),
  location: nodeLocationSchema,
  cost: nodeCostSchema,
  userStatus: z.enum(['pending', 'approved', 'rejected', 'modified']).default('pending'),
  isAiGenerated: z.boolean().default(true),
  isUserModified: z.boolean().default(false),
  createdAt: z.string().datetime(),
})

const itineraryNodeSchema = z.discriminatedUnion('type', [
  baseNodeSchema.extend({
    type: z.literal('poi'),
    category: z.string().optional(),
    openingHours: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('restaurant'),
    cuisine: z.string().optional(),
    priceRange: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    reservationRequired: z.boolean().optional(),
    reservationUrl: z.string().url().optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('transport'),
    transportMode: z.enum(['metro', 'bus', 'taxi', 'walking', 'ferry', 'train', 'car']).optional(),
    fromLocation: z.string().optional(),
    toLocation: z.string().optional(),
    lineNumber: z.string().optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('hotel_checkin'),
    hotelName: z.string().optional(),
    checkOutDate: z.string().regex(dateRe).optional(),
    confirmationNumber: z.string().optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('activity'),
    category: z.string().optional(),
    bookingRequired: z.boolean().optional(),
    bookingUrl: z.string().url().optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('free_time'),
    suggestions: z.array(z.string()).optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('note'),
    noteType: z.enum(['tip', 'warning', 'info']).optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('flight'),
    flightNumber: z.string().optional(),
    airline: z.string().optional(),
    departureAirport: z.string().optional(),
    arrivalAirport: z.string().optional(),
    departureTime: z.string().optional(),
    arrivalTime: z.string().optional(),
    terminal: z.string().optional(),
    gate: z.string().optional(),
  }),
])

const itineraryGraphSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().uuid(),
  status: z.enum(['draft', 'reviewing', 'approved', 'saved']),
  generatedBy: z.string().min(1),
  userPrompt: z.string().min(10),
  days: z
    .array(
      z.object({
        id: z.string().min(1),
        date: z.string().regex(dateRe),
        dayNumber: z.number().int().min(1),
        title: z.string().max(200).optional(),
        destinationCity: z.string().optional(),
        nodeIds: z.array(z.string().min(1)),
      })
    )
    .min(1),
  nodes: z.record(z.string(), itineraryNodeSchema),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      fromNodeId: z.string().min(1),
      toNodeId: z.string().min(1),
      type: z.enum(['sequential', 'transport', 'optional']),
      durationMinutes: z.number().int().min(0).optional(),
    })
  ),
  meta: z.object({
    totalDays: z.number().int().min(1),
    totalNodes: z.number().int().min(0),
    estimatedTotalCost: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    generationDurationMs: z.number().int().optional(),
    version: z.string(),
  }),
})

type ItineraryGraph = z.infer<typeof itineraryGraphSchema>

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

// ─── System prompt ────────────────────────────────────────────────────────────

const buildSystemPrompt = (language: 'es' | 'en'): string => {
  const tipLang = language === 'es' ? 'español' : 'inglés'
  return `Eres un experto planificador de viajes. Generas itinerarios detallados y realistas.

CRÍTICO: Tu respuesta debe ser EXCLUSIVAMENTE JSON válido. Sin texto previo, sin markdown, sin \`\`\`json, sin explicaciones. Solo el objeto JSON. Return ONLY valid JSON. No explanation, no markdown.

El JSON debe cumplir exactamente este schema TypeScript:

interface ItineraryGraph {
  id: string                    // ID corto único, ej: "itin-001"
  tripId: string                // UUID del viaje — usar el que se provee en el contexto
  status: "draft"               // siempre "draft" al generar
  generatedBy: "mistral-small-latest"
  userPrompt: string            // el pedido original del usuario sin modificar
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>  // objeto nodeId → nodo, NO array
  edges: ItineraryEdge[]
  meta: ItineraryMeta
}

interface ItineraryDay {
  id: string            // ej: "day-1", "day-2"
  date: string          // "YYYY-MM-DD"
  dayNumber: number     // 1, 2, 3...
  title?: string        // ej: "Día 1 — Llegada a París"
  destinationCity?: string
  nodeIds: string[]     // IDs de los nodos del día en orden cronológico
}

// Campos comunes — todos los nodos deben incluirlos
interface BaseNode {
  id: string            // ej: "node-001", "node-002" — único en todo el itinerario
  type: string          // discriminante — ver tipos abajo
  dayId: string         // ID del ItineraryDay al que pertenece
  order: number         // posición 0-based dentro del día
  time: string          // "HH:mm" — hora local del destino
  durationMinutes: number
  endTime: string       // "HH:mm" — time + durationMinutes calculado correctamente
  name: string          // nombre específico del lugar o actividad
  description: string   // descripción útil de 1-2 frases
  emoji: string         // emoji representativo
  aiTip: string         // consejo práctico en ${tipLang} — específico y útil
  location: { address?: string; lat?: number; lng?: number }
  cost: { amount?: number; currency?: string; isIncluded?: boolean }
  userStatus: "pending"   // siempre "pending"
  isAiGenerated: true
  isUserModified: false
  createdAt: string     // ISO 8601 con timezone, ej: "2026-04-22T00:00:00.000Z"
}

// Tipos específicos (uno de estos — el campo type es el discriminante):
// type: "poi"          — category?, openingHours?, rating?
// type: "restaurant"  — cuisine?, priceRange? (1|2|3|4), reservationRequired?
// type: "transport"   — transportMode? ("metro"|"bus"|"taxi"|"walking"|"ferry"|"train"|"car"), fromLocation?, toLocation?, lineNumber?
// type: "hotel_checkin" — hotelName?, checkOutDate? ("YYYY-MM-DD"), confirmationNumber?
// type: "activity"    — category?, bookingRequired?
// type: "free_time"   — suggestions? (string[])
// type: "note"        — noteType? ("tip"|"warning"|"info")
// type: "flight"      — flightNumber?, airline?, departureAirport?, arrivalAirport?

interface ItineraryEdge {
  id: string            // ej: "edge-001"
  fromNodeId: string    // nodeId origen
  toNodeId: string      // nodeId destino
  type: "sequential" | "transport" | "optional"
  durationMinutes?: number
}

interface ItineraryMeta {
  totalDays: number
  totalNodes: number
  estimatedTotalCost?: number
  currency?: string     // ISO 4217, ej: "EUR"
  version: "${SCHEMA_VERSION}"   // siempre "${SCHEMA_VERSION}"
}

REGLAS OBLIGATORIAS:
1. Un nodo de transporte entre ubicaciones distantes (>10 min a pie)
2. Al menos un restaurante por día
3. Ritmo de actividades: slow=4-5/día, moderate=6-7/día, intense=8-10/día
4. endTime calculado correctamente: si time="09:00" y durationMinutes=90, endTime="10:30"
5. Los IDs de nodes en nodeIds del día deben corresponder exactamente con las claves en el objeto nodes
6. nodes es un objeto Record (claves=IDs), NO un array
7. Todos los nodos del día aparecen en nodeIds y en nodes`
}

// ─── User prompt ──────────────────────────────────────────────────────────────

const buildUserPrompt = (userRequest: string, context: RequestContext): string => {
  const days =
    Math.ceil(
      (new Date(context.dates.end).getTime() - new Date(context.dates.start).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1

  const budgetLabel: Record<RequestContext['budget'], string> = {
    budget: 'económico',
    mid: 'estándar',
    premium: 'premium',
    luxury: 'lujo',
  }

  const paceLabel: Record<RequestContext['pace'], string> = {
    slow: 'tranquilo (4-5 actividades/día)',
    moderate: 'moderado (6-7 actividades/día)',
    intense: 'intenso (8-10 actividades/día)',
  }

  const styleLabel: Record<RequestContext['style'], string> = {
    cultural: 'cultural y patrimonial',
    adventure: 'aventura y naturaleza',
    gastronomy: 'gastronomía y mercados',
    relax: 'relax y bienestar',
    luxury: 'lujo y experiencias premium',
  }

  let prompt =
    `Genera un itinerario de viaje completo para la siguiente solicitud:\n\n"${userRequest}"\n\n` +
    `CONTEXTO DEL VIAJE:\n` +
    `- tripId: ${context.tripId}\n` +
    `- Fechas: del ${context.dates.start} al ${context.dates.end} (${days} día${days > 1 ? 's' : ''})\n` +
    `- Viajeros: ${context.travelers}\n` +
    `- Estilo: ${styleLabel[context.style]}\n` +
    `- Ritmo: ${paceLabel[context.pace]}\n` +
    `- Presupuesto: ${budgetLabel[context.budget]}\n`

  if (context.hotel) {
    prompt += `- Alojamiento: ${context.hotel}\n`
  }
  if (context.mustInclude?.length) {
    prompt += `- INCLUIR obligatoriamente: ${context.mustInclude.join(', ')}\n`
  }
  if (context.avoid?.length) {
    prompt += `- EVITAR: ${context.avoid.join(', ')}\n`
  }

  prompt +=
    `\nAsegúrate de usar exactamente tripId="${context.tripId}" en el JSON generado.` +
    `\n\nRESPONDE ÚNICAMENTE CON EL OBJETO JSON. Sin explicaciones, sin markdown, sin texto antes o después.`

  return prompt
}

// ─── Caché de itinerarios ─────────────────────────────────────────────────────

const buildCacheKey = (context: RequestContext): string => {
  // Clave basada en los parámetros que determinan el tipo de itinerario
  const parts = [
    context.dates.start,
    context.dates.end,
    context.style,
    context.pace,
    context.budget,
    context.travelers.toString(),
  ]
  return parts.join('|')
}

type SupabaseClient = ReturnType<typeof createClient>

const lookupCache = async (
  supabase: SupabaseClient,
  cacheKey: string
): Promise<(ItineraryGraph & { cached: boolean }) | null> => {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('itinerary_cache')
    .select('graph')
    .eq('cache_key', cacheKey)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.graph) return null

  return { ...(data.graph as ItineraryGraph), cached: true }
}

const saveToCache = async (
  supabase: SupabaseClient,
  cacheKey: string,
  graph: ItineraryGraph
): Promise<void> => {
  await supabase
    .from('itinerary_cache')
    .upsert({ cache_key: cacheKey, graph, created_at: new Date().toISOString() })
}

// ─── Registro de uso de IA ────────────────────────────────────────────────────

const incrementAiUsage = async (supabase: SupabaseClient, userId: string): Promise<void> => {
  await supabase.rpc('increment_ai_msgs', { user_id_param: userId })
}

// ─── Tipos de la respuesta de Mistral ────────────────────────────────────────

interface MistralMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface MistralResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// ─── Errores tipados ──────────────────────────────────────────────────────────

class MistralApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MistralApiError'
  }
}

class ZodValidationError extends Error {
  issues: z.ZodIssue[]
  constructor(issues: z.ZodIssue[]) {
    super('El JSON generado no cumple el schema')
    this.name = 'ZodValidationError'
    this.issues = issues
  }
}

// ─── Extracción de JSON de la respuesta del modelo ───────────────────────────

// Limpia texto extra que el modelo pueda añadir antes/después del JSON
const extractJson = (rawText: string): string => {
  // Extraer de bloque markdown ```json ... ```
  const mdMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) return mdMatch[1].trim()

  // Extraer el primer objeto JSON del texto si hay texto extra alrededor
  const objectMatch = rawText.match(/\{[\s\S]*\}/)
  return objectMatch ? objectMatch[0] : rawText
}

// ─── Llamada a Mistral con reintento automático ───────────────────────────────

const callMistralWithRetry = async (
  apiKey: string,
  userRequest: string,
  context: RequestContext,
  signal: AbortSignal
): Promise<ItineraryGraph> => {
  const systemPrompt = buildSystemPrompt(context.language)
  const userPrompt = buildUserPrompt(userRequest, context)

  const messages: MistralMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let lastZodError: z.ZodIssue[] | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[generate-itinerary] Intento ${attempt}/${MAX_RETRIES} para tripId: ${context.tripId}`)
    // Añadir mensaje de corrección en reintentos
    if (attempt > 1 && lastZodError) {
      const errorSummary = lastZodError
        .slice(0, 5)
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')

      messages.push({
        role: 'user',
        content:
          `El JSON que generaste tiene errores de validación. Corrígelos y devuelve SOLO el JSON corregido:\n\n${errorSummary}\n\nDevuelve únicamente el JSON válido sin ningún texto adicional.`,
      })
    }

    let rawText: string
    try {
      console.log(`[generate-itinerary] Enviando request a Mistral API...`)
      const res = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            max_tokens: MAX_TOKENS,
            response_format: { type: 'json_object' },
          }),
        signal,
      })

      if (!res.ok) {
        const errorBody = await res.text()
        throw new MistralApiError(`Mistral respondió con status ${res.status}: ${errorBody}`)
      }

      const data = await res.json() as MistralResponse
      rawText = data.choices[0]?.message?.content?.trim() ?? ''

      if (!rawText) throw new MistralApiError('Mistral devolvió contenido vacío')
      console.log(`[generate-itinerary] Respuesta recibida de Mistral, longitud: ${rawText.length} chars`)
    } catch (err) {
      if (err instanceof MistralApiError) throw err
      throw new MistralApiError(`Fallo al llamar a la API de Mistral: ${(err as Error).message}`)
    }

    const cleanJson = extractJson(rawText)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleanJson)
    } catch {
      console.error(`[attempt ${attempt}] JSON inválido — primeros 500 chars:`, rawText.slice(0, 500))
      lastZodError = [
        {
          code: 'custom',
          message: 'La respuesta no es JSON válido',
          path: [],
        } as z.ZodIssue,
      ]
      // Añadir la respuesta incorrecta al historial para que el modelo la corrija
      messages.push({ role: 'assistant', content: rawText })
      continue
    }

    const validation = itineraryGraphSchema.safeParse(parsed)
    if (validation.success) {
      return validation.data
    }

    lastZodError = validation.error.issues
    // Añadir la respuesta incorrecta para el reintento
    messages.push({ role: 'assistant', content: rawText })
  }

  throw new ZodValidationError(lastZodError ?? [])
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)

  try {
    // 1. Validar entrada
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Body JSON inválido' }, 400)
    }

    const parseResult = requestSchema.safeParse(body)
    if (!parseResult.success) {
      return jsonResponse(
        { error: 'Datos de entrada inválidos', details: parseResult.error.flatten() },
        422
      )
    }
    const { userRequest, context } = parseResult.data

    // 2. Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'No autorizado' }, 401)

    // 3. Buscar en caché — si existe, evita la llamada a Mistral
    console.log(`[generate-itinerary] Verificando caché para tripId: ${context.tripId}`)
    const cacheKey = buildCacheKey(context)
    const cached = await lookupCache(supabase, cacheKey)
    if (cached) {
      console.log(`[generate-itinerary] Itinerario encontrado en caché`)
      clearTimeout(timeoutId)
      return jsonResponse(cached, 200)
    }
    console.log(`[generate-itinerary] No encontrado en caché, llamando a Mistral`)

    // 4. Verificar que la API key está configurada
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY')
    if (!mistralApiKey) {
      clearTimeout(timeoutId)
      return jsonResponse({ error: 'MISTRAL_API_KEY no configurada' }, 500)
    }

    // 5. Llamar a Mistral con reintento automático
    console.log(`[generate-itinerary] Iniciando generación con Mistral para tripId: ${context.tripId}`)
    const startMs = Date.now()

    const graph = await callMistralWithRetry(
      mistralApiKey,
      userRequest,
      context,
      timeoutController.signal
    )

    console.log(`[generate-itinerary] Generación completada en ${Date.now() - startMs}ms`)

    // Inyectar duración de generación (no la tenía Mistral al construir el JSON)
    graph.meta.generationDurationMs = Date.now() - startMs

    // 6. Guardar en caché
    await saveToCache(supabase, cacheKey, graph)

    // 7. Incrementar contador de uso del usuario
    await incrementAiUsage(supabase, user.id)

    clearTimeout(timeoutId)
    return jsonResponse(graph, 200)
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`[generate-itinerary] Timeout alcanzado para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`)
      return jsonResponse({ error: 'Timeout: el servicio de IA tardó demasiado' }, 503)
    }
    if (error instanceof MistralApiError) {
      console.error(`[generate-itinerary] Error de API Mistral para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`, error.message)
      return jsonResponse({ error: error.message }, 503)
    }
    if (error instanceof ZodValidationError) {
      console.error(`[generate-itinerary] Error de validación Zod para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`, error.issues)
      return jsonResponse(
        {
          error: 'El itinerario generado no cumple el schema tras los reintentos',
          issues: error.issues.slice(0, 10),
        },
        422
      )
    }

    console.error(`[generate-itinerary] Error inesperado para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`, error)
    return jsonResponse({ error: 'Error interno del servidor' }, 500)
  }
})
