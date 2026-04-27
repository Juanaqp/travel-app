// Edge Function: generate-itinerary
// POST /functions/v1/generate-itinerary
// Genera el itinerario inicial con OpenAI para un viaje dado.
// Incluye normalización de salida del modelo, caché de 72h, reintentos y registro de uso.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIMEOUT_MS = 200_000  // 200s: permite 2 llamadas de ~60-80s c/u + margen
const MAX_RETRIES = 2       // Reducido: cada llamada tarda ~60s, 3 superaban el timeout
const CACHE_TTL_HOURS = 72
const MODEL = 'gpt-4o-mini'
const MAX_OUTPUT_TOKENS = 8192
const SCHEMA_VERSION = '2.1.0'
const OPENAI_BASE_URL = 'https://api.openai.com/v1'

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

// ─── Schema Zod tolerante del ItineraryGraph ──────────────────────────────────
// Estrategia: z.preprocess y .catch() absorben variaciones comunes del modelo.
// La capa normalizeItinerary (antes del parse) corrige los casos más frecuentes.

const timeRe = /^\d{2}:\d{2}$/
const dateRe = /^\d{4}-\d{2}-\d{2}$/

// Acepta string u objeto {name?, address?} y lo convierte a string
const flexLocationString = z.preprocess(
  (val) => {
    if (typeof val === 'string') return val
    if (val && typeof val === 'object') {
      const o = val as Record<string, unknown>
      return String(o.name ?? o.address ?? '')
    }
    return ''
  },
  z.string()
)

// Acepta cualquier string parseable como fecha; si falla o falta, usa ahora
const flexDatetime = z.preprocess(
  (val) => {
    if (!val) return new Date().toISOString()
    const d = new Date(String(val))
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  },
  z.string()
)

// Acepta fecha ISO (con o sin tiempo) y extrae solo YYYY-MM-DD
const flexDate = z.preprocess(
  (val) => {
    if (!val) return undefined
    const m = String(val).match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : String(val)
  },
  z.string().regex(dateRe)
)

const nodeCostSchema = z.object({
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  isIncluded: z.boolean().optional(),
}).passthrough().catch({})

const nodeLocationSchema = z.object({
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
}).passthrough().catch({})

const baseNodeSchema = z.object({
  id: z.string().min(1),
  dayId: z.string().min(1),
  order: z.number().int().min(0),
  time: z.string().regex(timeRe),
  durationMinutes: z.number().int().min(1),
  endTime: z.string().regex(timeRe),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).catch(''),
  emoji: z.string().max(10).catch('📍'),
  aiTip: z.string().max(500).catch(''),
  location: nodeLocationSchema,
  cost: nodeCostSchema,
  // Valores del sistema — inyectados desde backend, .catch() garantiza el valor correcto
  userStatus: z.enum(['pending', 'approved', 'rejected', 'modified']).catch('pending'),
  isAiGenerated: z.boolean().catch(true),
  isUserModified: z.boolean().catch(false),
  createdAt: flexDatetime,
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
    // El modelo a veces envía "$", "$$" u otros strings — convertir a número 1-4
    priceRange: z.preprocess(
      (val) => {
        if (val === undefined || val === null) return undefined
        if (typeof val === 'number') return [1, 2, 3, 4].includes(val) ? val : undefined
        if (typeof val === 'string') {
          const n = parseInt(val.replace(/\D/g, '') || '0', 10)
          return [1, 2, 3, 4].includes(n) ? n : val.length >= 1 && val.length <= 4 ? val.length : undefined
        }
        return undefined
      },
      z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional()
    ).optional(),
    reservationRequired: z.boolean().optional(),
    reservationUrl: z.string().optional(),  // Sin .url() — el modelo genera URLs no estándar
  }),
  baseNodeSchema.extend({
    type: z.literal('transport'),
    transportMode: z.enum(['metro', 'bus', 'taxi', 'walking', 'ferry', 'train', 'car']).catch('walking').optional(),
    fromLocation: flexLocationString.optional(),  // Acepta objeto o string
    toLocation: flexLocationString.optional(),    // Acepta objeto o string
    lineNumber: z.string().optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('hotel_checkin'),
    hotelName: z.string().optional(),
    checkOutDate: flexDate.optional(),
    confirmationNumber: z.string().optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('activity'),
    category: z.string().optional(),
    bookingRequired: z.boolean().optional(),
    bookingUrl: z.string().optional(),  // Sin .url()
  }),
  baseNodeSchema.extend({
    type: z.literal('free_time'),
    suggestions: z.array(z.string()).optional(),
  }),
  baseNodeSchema.extend({
    type: z.literal('note'),
    noteType: z.enum(['tip', 'warning', 'info']).catch('info').optional(),
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
  status: z.enum(['draft', 'reviewing', 'approved', 'saved']).catch('draft'),
  generatedBy: z.string().min(1),
  userPrompt: z.string().min(1),
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
  edges: z
    .array(
      z.object({
        id: z.string().min(1),
        fromNodeId: z.string().min(1),
        toNodeId: z.string().min(1),
        type: z.enum(['sequential', 'transport', 'optional']).catch('sequential'),
        durationMinutes: z.number().int().min(0).optional(),
      })
    )
    .default([]),
  meta: z.object({
    totalDays: z.number().int().min(1),
    totalNodes: z.number().int().min(0),
    estimatedTotalCost: z.number().min(0).optional(),
    currency: z.string().optional(),
    generationDurationMs: z.number().int().optional(),
    version: z.string(),
  }),
})

type ItineraryGraph = z.infer<typeof itineraryGraphSchema>

// ─── Normalización de salida del modelo ───────────────────────────────────────
// Corre ANTES de la validación Zod. Corrige errores comunes del modelo
// sin alterar la semántica del itinerario.

function normalizeItinerary(data: Record<string, unknown>): Record<string, unknown> {
  // Garantizar estructura mínima del grafo
  if (typeof data.nodes !== 'object' || data.nodes === null || Array.isArray(data.nodes)) {
    data.nodes = {}
  }
  if (!Array.isArray(data.days)) data.days = []
  if (!Array.isArray(data.edges)) data.edges = []

  const now = new Date().toISOString()
  const nodes = data.nodes as Record<string, unknown>

  for (const nodeId of Object.keys(nodes)) {
    const node = nodes[nodeId]
    if (typeof node !== 'object' || node === null) continue
    const n = node as Record<string, unknown>

    // Inyectar createdAt si falta o tiene formato inválido
    if (!n.createdAt || typeof n.createdAt !== 'string' || isNaN(new Date(n.createdAt).getTime())) {
      n.createdAt = now
    }

    // fromLocation / toLocation: objeto → string (error común en modelos de lenguaje)
    for (const field of ['fromLocation', 'toLocation']) {
      if (n[field] !== undefined && typeof n[field] !== 'string') {
        const loc = n[field] as Record<string, unknown>
        n[field] = String(loc?.name ?? loc?.address ?? '')
      }
    }

    // Eliminar campos URL vacíos o no-string que fallarían el schema
    for (const field of ['reservationUrl', 'bookingUrl']) {
      if (n[field] !== undefined) {
        if (typeof n[field] !== 'string' || (n[field] as string).trim() === '') {
          delete n[field]
        }
      }
    }

    // Valores críticos del sistema — siempre inyectados desde backend, nunca del modelo
    n.userStatus = 'pending'
    n.isAiGenerated = true
    n.isUserModified = false

    nodes[nodeId] = n
  }

  data.nodes = nodes
  return data
}

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

REGLA ABSOLUTA: Responde EXCLUSIVAMENTE con un objeto JSON válido. Sin texto previo, sin markdown, sin \`\`\`json, sin explicaciones.
Si no puedes generar el itinerario, responde SOLO: {"error":"invalid_structure"}

El JSON debe cumplir exactamente este schema:

interface ItineraryGraph {
  id: string                    // ID corto único, ej: "itin-001"
  tripId: string                // UUID del viaje — copiar EXACTAMENTE el del contexto
  status: "draft"
  generatedBy: "gpt-4o-mini"
  userPrompt: string
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>  // OBJETO clave→nodo, NUNCA array
  edges: ItineraryEdge[]
  meta: ItineraryMeta
}

interface ItineraryDay {
  id: string            // "day-1", "day-2"...
  date: string          // "YYYY-MM-DD"
  dayNumber: number
  title?: string
  destinationCity?: string
  nodeIds: string[]     // IDs en orden cronológico
}

interface BaseNode {
  id: string            // único: "node-001", "node-002"...
  type: string          // ver tipos abajo
  dayId: string
  order: number         // 0-based
  time: string          // "HH:mm" OBLIGATORIO — ej: "09:00"
  durationMinutes: number
  endTime: string       // "HH:mm" calculado — ej: "10:30"
  name: string
  description: string
  emoji: string
  aiTip: string         // consejo práctico en ${tipLang}
  location: { address?: string; lat?: number; lng?: number }
  cost: { amount?: number; currency?: string; isIncluded?: boolean }
  userStatus: "pending"
  isAiGenerated: true
  isUserModified: false
  createdAt: string     // OBLIGATORIO — ISO 8601: "2026-04-25T00:00:00.000Z"
}

Tipos específicos:
- poi: category?, openingHours?, rating?
- restaurant: cuisine?, priceRange? (NÚMERO 1|2|3|4), reservationRequired?, reservationUrl?
- transport: transportMode? ("metro"|"bus"|"taxi"|"walking"|"ferry"|"train"|"car"), fromLocation?, toLocation?, lineNumber?
- hotel_checkin: hotelName?, checkOutDate? ("YYYY-MM-DD"), confirmationNumber?
- activity: category?, bookingRequired?, bookingUrl?
- free_time: suggestions? (string[])
- note: noteType? ("tip"|"warning"|"info")
- flight: flightNumber?, airline?, departureAirport?, arrivalAirport?

interface ItineraryEdge {
  id: string; fromNodeId: string; toNodeId: string
  type: "sequential"|"transport"|"optional"; durationMinutes?: number
}

interface ItineraryMeta {
  totalDays: number; totalNodes: number
  estimatedTotalCost?: number; currency?: string
  version: "${SCHEMA_VERSION}"
}

TIPOS CRÍTICOS — respetar exactamente:
1. fromLocation y toLocation → STRING, NUNCA objeto. Correcto: "Shibuya Station". Incorrecto: {"name":"Shibuya"}
2. priceRange → NÚMERO entero (1, 2, 3 o 4), NUNCA string como "$" o "$$"
3. createdAt → OBLIGATORIO en cada nodo, formato ISO: "2026-04-25T00:00:00.000Z"
4. time / endTime → "HH:mm" exacto — "09:00", "10:30"
5. nodes → Record<string, Node> (objeto), NUNCA array

REGLAS DE CONTENIDO:
- Al menos 1 nodo transport entre zonas distantes (>10 min a pie)
- Al menos 1 restaurant por día
- slow=4-5 nodos/día · moderate=6-7/día · intense=8-10/día
- nodeIds del día deben coincidir exactamente con las claves de nodes`
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
    `\nUSA exactamente tripId="${context.tripId}" en el JSON.` +
    `\nRecuerda: fromLocation y toLocation son STRINGS, createdAt es OBLIGATORIO en cada nodo.` +
    `\n\nRESPONDE ÚNICAMENTE CON EL OBJETO JSON. Sin explicaciones, sin markdown.`

  return prompt
}

// ─── Caché de itinerarios ─────────────────────────────────────────────────────

const buildCacheKey = (context: RequestContext): string => {
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

// ─── Tipos de la respuesta de OpenAI ─────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  choices: Array<{
    message: { role: string; content: string }
    finish_reason?: string  // 'stop' = completo · 'length' = truncado
  }>
}

// ─── Errores tipados ──────────────────────────────────────────────────────────

class OpenAIApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenAIApiError'
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

const extractJson = (rawText: string): string => {
  const mdMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) return mdMatch[1].trim()

  const objectMatch = rawText.match(/\{[\s\S]*\}/)
  return objectMatch ? objectMatch[0] : rawText
}

// ─── Construcción del mensaje de corrección para reintentos ──────────────────

const buildCorrectionPrompt = (issues: z.ZodIssue[]): string => {
  const lines = issues.slice(0, 8).map((e) => {
    const path = e.path.join('.') || '(raíz)'
    return `- ${path}: ${e.message}`
  })

  return (
    `El JSON tiene ${issues.length} errores de validación. Corrige SOLO estos campos:\n\n` +
    lines.join('\n') +
    `\n\nRecuerda:\n` +
    `- fromLocation y toLocation deben ser STRINGS, no objetos\n` +
    `- createdAt es OBLIGATORIO en cada nodo (ISO 8601: "2026-04-25T00:00:00.000Z")\n` +
    `- priceRange debe ser número 1, 2, 3 o 4\n` +
    `\nDevuelve el JSON COMPLETO corregido. Sin explicaciones, sin markdown.`
  )
}

// ─── Llamada a OpenAI con reintento inteligente ───────────────────────────────

const callOpenAIWithRetry = async (
  apiKey: string,
  userRequest: string,
  context: RequestContext,
  signal: AbortSignal
): Promise<ItineraryGraph> => {
  const systemPrompt = buildSystemPrompt(context.language)
  const userPrompt = buildUserPrompt(userRequest, context)
  const url = `${OPENAI_BASE_URL}/chat/completions`

  let lastZodError: z.ZodIssue[] | null = null
  let lastRawText: string | null = null  // Respuesta anterior del modelo para multi-turn

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[generate-itinerary] Intento ${attempt}/${MAX_RETRIES} para tripId: ${context.tripId}`)

    // Si el error anterior fue truncación (JSON.parse falló), reiniciar el historial
    // para no acumular una respuesta incompleta y consumir tokens del contexto.
    const isJsonParseError =
      lastZodError?.length === 1 && lastZodError[0].message === 'La respuesta no es JSON válido'

    // Construir historial de mensajes
    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    if (attempt > 1 && lastZodError && !isJsonParseError && lastRawText) {
      // Multi-turn: incluir respuesta anterior y prompt de corrección
      messages.push({ role: 'assistant', content: lastRawText })
      messages.push({ role: 'user', content: buildCorrectionPrompt(lastZodError) })
    }

    let rawText: string
    try {
      console.log(`[generate-itinerary] Enviando request a OpenAI API...`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal,
      })

      if (!res.ok) {
        const errorBody = await res.text()
        throw new OpenAIApiError(`OpenAI respondió con status ${res.status}: ${errorBody}`)
      }

      const data = (await res.json()) as OpenAIResponse
      const choice = data.choices?.[0]
      rawText = choice?.message?.content?.trim() ?? ''
      const finishReason = choice?.finish_reason ?? 'UNKNOWN'

      if (!rawText) throw new OpenAIApiError('OpenAI devolvió contenido vacío')
      lastRawText = rawText  // Guardar para el reintento multi-turn si este intento falla
      console.log(
        `[generate-itinerary] Respuesta OpenAI — longitud: ${rawText.length} chars, finishReason: ${finishReason}`
      )
      if (finishReason === 'length') {
        console.warn(
          `[attempt ${attempt}] finish_reason=length — respuesta truncada (${MAX_OUTPUT_TOKENS} tokens)`
        )
      }
    } catch (err) {
      if (err instanceof OpenAIApiError) throw err
      throw new OpenAIApiError(`Fallo al llamar a la API de OpenAI: ${(err as Error).message}`)
    }

    // ── Paso 1: extraer JSON de texto con posible markdown o texto extra ────
    const cleanJson = extractJson(rawText)

    // ── Paso 2: parsear JSON ──────────────────────────────────────────────────
    let parsed: unknown
    try {
      parsed = JSON.parse(cleanJson)
    } catch {
      console.error(`[attempt ${attempt}] JSON no parseable — longitud: ${rawText.length} chars`)
      console.error(`[attempt ${attempt}] Inicio (500 chars):`, rawText.slice(0, 500))
      lastZodError = [
        { code: 'custom', message: 'La respuesta no es JSON válido', path: [] } as z.ZodIssue,
      ]
      // No agregar la respuesta truncada al historial — evita consumir tokens extra
      continue
    }

    // ── Paso 3: detectar respuesta de error explícita del modelo ─────────────
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Record<string, unknown>).error === 'invalid_structure'
    ) {
      console.error(`[attempt ${attempt}] El modelo indicó invalid_structure`)
      lastZodError = [
        { code: 'custom', message: 'Modelo indicó invalid_structure', path: [] } as z.ZodIssue,
      ]
      continue
    }

    // ── Paso 4: normalizar antes de validar ───────────────────────────────────
    console.log(`[attempt ${attempt}] JSON parseado (inicio 800 chars):`, cleanJson.slice(0, 800))
    const normalized = normalizeItinerary(parsed as Record<string, unknown>)

    // ── Paso 5: validar con Zod ───────────────────────────────────────────────
    const validation = itineraryGraphSchema.safeParse(normalized)
    if (validation.success) {
      console.log(`[attempt ${attempt}] Validación Zod exitosa`)
      return validation.data
    }

    lastZodError = validation.error.issues
    console.error(
      `[attempt ${attempt}] Zod inválido — ${validation.error.issues.length} errores:`,
      JSON.stringify(validation.error.issues.slice(0, 8))
    )
    console.error(`[attempt ${attempt}] JSON fin (500 chars):`, cleanJson.slice(-500))
  }

  throw new ZodValidationError(lastZodError ?? [])
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)

  let parseResult: z.SafeParseReturnType<z.infer<typeof requestSchema>, z.ZodError> | undefined

  try {
    // 1. Validar entrada
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Body JSON inválido' }, 400)
    }

    parseResult = requestSchema.safeParse(body)
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

    // 3. Buscar en caché
    console.log(`[generate-itinerary] Verificando caché para tripId: ${context.tripId}`)
    const cacheKey = buildCacheKey(context)
    const cached = await lookupCache(supabase, cacheKey)
    if (cached) {
      console.log(`[generate-itinerary] Itinerario encontrado en caché`)
      clearTimeout(timeoutId)
      return jsonResponse(cached, 200)
    }
    console.log(`[generate-itinerary] No encontrado en caché, llamando a OpenAI`)

    // 4. Verificar API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      clearTimeout(timeoutId)
      return jsonResponse({ error: 'OPENAI_API_KEY no configurada' }, 500)
    }

    // 5. Llamar a OpenAI con normalización + validación + reintento
    console.log(`[generate-itinerary] Iniciando generación con OpenAI para tripId: ${context.tripId}`)
    const startMs = Date.now()

    const graph = await callOpenAIWithRetry(
      openaiApiKey,
      userRequest,
      context,
      timeoutController.signal
    )

    const durationMs = Date.now() - startMs
    console.log(`[generate-itinerary] Generación completada en ${durationMs}ms`)

    // Inyectar duración desde el backend (el modelo no la conoce al generar el JSON)
    graph.meta.generationDurationMs = durationMs

    // 6. Guardar en caché
    await saveToCache(supabase, cacheKey, graph)

    // 7. Incrementar contador de uso del usuario
    await incrementAiUsage(supabase, user.id)

    clearTimeout(timeoutId)
    return jsonResponse(graph, 200)
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(
        `[generate-itinerary] Timeout alcanzado para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`
      )
      return jsonResponse({ error: 'Timeout: el servicio de IA tardó demasiado' }, 503)
    }
    if (error instanceof OpenAIApiError) {
      console.error(
        `[generate-itinerary] Error de API OpenAI para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`,
        (error as OpenAIApiError).message
      )
      return jsonResponse({ error: (error as OpenAIApiError).message }, 503)
    }
    if (error instanceof ZodValidationError) {
      console.error(
        `[generate-itinerary] Error de validación Zod para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`,
        error.issues
      )
      return jsonResponse(
        {
          error: 'El itinerario generado no cumple el schema tras los reintentos',
          issues: error.issues.slice(0, 10),
        },
        422
      )
    }

    console.error(
      `[generate-itinerary] Error inesperado para tripId: ${parseResult?.data?.context?.tripId || 'unknown'}`,
      error
    )
    return jsonResponse({ error: 'Error interno del servidor' }, 500)
  }
})
