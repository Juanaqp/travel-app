// Edge Function: parse-expense
// POST /functions/v1/parse-expense
// Analiza texto de gasto (entrada manual o transcripción de voz) con OpenAI.
// Retorna tipo, confianza, texto original y campos estructurados.
// Incluye caché por hash del texto y fallback de gpt-4o-mini a gpt-4o.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod'
import { errorResponse } from '../_shared/errors.ts'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODEL_DEFAULT = 'gpt-4o-mini'
const MODEL_FALLBACK = 'gpt-4o'
const MAX_TOKENS = 512
const CACHE_TTL_HOURS = 24
const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const MAX_TEXT_LENGTH = 1000

// ─── Schema de entrada ────────────────────────────────────────────────────────

const requestSchema = z.object({
  text: z.string().min(3).max(MAX_TEXT_LENGTH),
  tripId: z.string().uuid().optional(),
  language: z.enum(['es', 'en']).default('es'),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// ─── Tipo de resultado ────────────────────────────────────────────────────────

interface ParsedFields {
  amount: number | null
  currency: string | null
  category: string | null
  title: string | null
  date: string | null
}

interface ParseResult {
  type: 'expense'
  confidence: number
  raw_text: string
  fields: ParsedFields
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

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

// ─── Hash SHA-256 del texto normalizado para caché ────────────────────────────

const hashText = async (text: string): Promise<string> => {
  const encoder = new TextEncoder()
  const normalized = text.toLowerCase().trim()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// ─── Prompt del sistema ───────────────────────────────────────────────────────

const buildSystemPrompt = (language: string, currentDate: string): string => {
  // Calcular ayer para instrucción de fecha relativa
  const d = new Date(currentDate)
  d.setDate(d.getDate() - 1)
  const yesterday = d.toISOString().slice(0, 10)

  const langNote = language === 'es' ? 'El usuario habla en español' : 'The user speaks English'

  return `Eres un extractor de datos de gastos de viaje. Analizas texto libre y devuelves información estructurada.

${langNote}. Fecha actual: ${currentDate}.

REGLA ABSOLUTA: Responde EXCLUSIVAMENTE con un objeto JSON válido. Sin texto, sin markdown, sin explicaciones.

Estructura requerida:
{
  "type": "expense",
  "confidence": 0.0-1.0,
  "raw_text": "texto original del usuario sin modificar",
  "fields": {
    "amount": número o null,
    "currency": "código ISO 4217 (USD/EUR/PEN/ARS/MXN/BRL/etc.) o null",
    "category": "food|transport|accommodation|activities|shopping|health|communication|other o null",
    "title": "descripción corta legible (máximo 40 chars) o null",
    "date": "fecha ISO YYYY-MM-DD o null"
  }
}

Reglas de extracción:
- amount: solo el número sin símbolo (40, no "40€"). Si hay múltiples montos suma solo el total si el contexto lo indica.
- currency: inferir del símbolo/nombre (€→EUR, $→USD o según contexto, S/→PEN, etc.). Si el contexto no aclara → null.
- category: inferir por contexto:
    restaurante/cena/almuerzo/desayuno/bar/café/comida → food
    taxi/uber/metro/bus/tren/vuelo/gasolina → transport
    hotel/hostal/airbnb/alojamiento → accommodation
    museo/tour/entrada/actividad/excursión → activities
    tienda/ropa/souvenirs/compras → shopping
    farmacia/médico/seguro → health
    teléfono/sim/wifi/internet → communication
    resto → other
- title: en el idioma del usuario, capitalizado, sin artículos si es posible (ej: "Cena en Roma", "Taxi al aeropuerto")
- date: si dice "ayer" → ${yesterday}; si dice "hoy" o sin fecha → ${currentDate}; si da fecha relativa calcularlo; si da fecha exacta → convertir a YYYY-MM-DD
- confidence: 1.0 si todo está claro, 0.7 si hay alguna ambigüedad, 0.4 si hay incertidumbre significativa, 0.2 si es muy vago
- NO inventar datos no mencionados
- NO incluir campos con string vacío ""
- Si confidence < 0.3 → usar category "other" y title null`
}

// ─── Llamada a OpenAI ─────────────────────────────────────────────────────────

const callOpenAI = async (
  apiKey: string,
  model: string,
  text: string,
  language: string,
  currentDate: string
): Promise<ParseResult> => {
  const systemPrompt = buildSystemPrompt(language, currentDate)

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`OpenAI respondió ${res.status}: ${errBody}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const rawContent = data.choices?.[0]?.message?.content?.trim() ?? ''

  if (!rawContent) throw new Error('OpenAI devolvió contenido vacío')

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error('OpenAI devolvió JSON inválido')
  }

  // Validar estructura mínima
  if (parsed.type !== 'expense' || typeof parsed.confidence !== 'number' || !parsed.fields) {
    throw new Error('Respuesta de OpenAI con estructura inválida: faltan campos obligatorios')
  }

  const fields = parsed.fields as Record<string, unknown>

  return {
    type: 'expense',
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence))),
    raw_text: typeof parsed.raw_text === 'string' ? parsed.raw_text : text,
    fields: {
      amount: typeof fields.amount === 'number' ? fields.amount : null,
      currency: typeof fields.currency === 'string' && fields.currency ? fields.currency : null,
      category: typeof fields.category === 'string' && fields.category ? fields.category : null,
      title: typeof fields.title === 'string' && fields.title ? fields.title : null,
      date: typeof fields.date === 'string' && fields.date ? fields.date : null,
    },
  }
}

// ─── Caché de resultados ──────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>

const lookupCache = async (
  supabase: SupabaseClient,
  textHash: string
): Promise<ParseResult | null> => {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('expense_parse_cache')
    .select('result')
    .eq('text_hash', textHash)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.result) return null
  return data.result as ParseResult
}

const saveToCache = async (
  supabase: SupabaseClient,
  textHash: string,
  result: ParseResult
): Promise<void> => {
  const { error } = await supabase
    .from('expense_parse_cache')
    .upsert({ text_hash: textHash, result, created_at: new Date().toISOString() })

  if (error) {
    // No bloquear la respuesta si falla el caché
    console.warn('[parse-expense] No se pudo guardar en caché:', error.message)
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Método no permitido', 405)
  }

  try {
    // 1. Parsear y validar entrada
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return errorResponse('INVALID_BODY', 'Body JSON inválido', 400)
    }

    const parseResult = requestSchema.safeParse(body)
    if (!parseResult.success) {
      return errorResponse('INVALID_INPUT', 'Datos inválidos', 422)
    }

    const { text, tripId, language, currentDate } = parseResult.data
    const effectiveDate = currentDate ?? new Date().toISOString().slice(0, 10)

    // 2. Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('UNAUTHORIZED', 'No autorizado', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponse('UNAUTHORIZED', 'No autorizado', 401)

    // 3. Verificar caché por hash del texto (sin loggear el texto completo)
    const textHash = await hashText(text)
    console.log(`[parse-expense] userId=${user.id} textLen=${text.length} hash=${textHash}`)

    const cached = await lookupCache(supabase, textHash)
    if (cached) {
      console.log(`[parse-expense] Resultado encontrado en caché — hash=${textHash}`)
      return jsonResponse({ ...cached, cached: true, tripId }, 200)
    }

    // 4. Verificar API key de OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) return errorResponse('MISSING_CONFIG', 'OPENAI_API_KEY no configurada', 500)

    // 5. Llamar a OpenAI — fallback automático de gpt-4o-mini a gpt-4o si falla
    let result: ParseResult
    try {
      console.log(`[parse-expense] Intentando con ${MODEL_DEFAULT}`)
      result = await callOpenAI(openaiApiKey, MODEL_DEFAULT, text, language, effectiveDate)
    } catch (firstErr) {
      console.warn(
        `[parse-expense] ${MODEL_DEFAULT} falló — reintentando con ${MODEL_FALLBACK}:`,
        (firstErr as Error).message
      )
      try {
        result = await callOpenAI(openaiApiKey, MODEL_FALLBACK, text, language, effectiveDate)
      } catch (secondErr) {
        console.error(`[parse-expense] ${MODEL_FALLBACK} también falló:`, (secondErr as Error).message)
        return errorResponse('AI_UNAVAILABLE', 'No se pudo analizar el texto', 503)
      }
    }

    // 6. Guardar en caché para futuras solicitudes del mismo texto
    await saveToCache(supabase, textHash, result)

    console.log(`[parse-expense] Completado — confidence=${result.confidence} category=${result.fields.category}`)
    return jsonResponse({ ...result, cached: false, tripId }, 200)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[parse-expense] Error inesperado:', errMsg)
    return errorResponse('INTERNAL_ERROR', 'Error interno del servidor', 500)
  }
})
