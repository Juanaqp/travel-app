// Edge Function: get-destination-info
// Devuelve información detallada de un destino generada por OpenAI.
// Requiere autenticación. Cache de 7 días en itinerary_cache.
// Cuenta para el rate limit mensual del usuario.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { errorResponse } from '../_shared/errors.ts'
import { checkAndIncrementUsage, RateLimitExceededError } from '../_shared/rateLimiter.ts'

// ─── Types (inlineados — los tipos canónicos viven en packages/types/explore.ts) ─

interface DestinationInfo {
  best_months: string[]
  avg_budget_per_day_usd: number
  recommended_days: number
  highlights: string[]
  cuisine: string[]
  tips: string[]
  timezone: string
  currency: string
  language: string
  cached?: boolean
}

// ─── Schema de validación de la petición ─────────────────────────────────────

const requestSchema = z.object({
  destination: z.string().min(1).max(120),
})

// ─── Schema de validación de la respuesta de OpenAI ──────────────────────────

const destinationInfoSchema = z.object({
  best_months: z.array(z.string()).min(1).max(12),
  avg_budget_per_day_usd: z.number().positive(),
  recommended_days: z.number().int().positive(),
  highlights: z.array(z.string()).min(1).max(10),
  cuisine: z.array(z.string()).min(1).max(10),
  tips: z.array(z.string()).min(1).max(5),
  timezone: z.string(),
  currency: z.string().length(3),
  language: z.string(),
})

// ─── Llamada a OpenAI con reintento en gpt-4o si gpt-4o-mini falla ───────────

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'] as const

const callOpenAI = async (apiKey: string, destination: string): Promise<DestinationInfo> => {
  const prompt = `Responde SOLO en JSON válido sin markdown ni texto adicional.
Para el destino "${destination}" devuelve:
{
  "best_months": ["mes1", "mes2", "mes3"],
  "avg_budget_per_day_usd": número,
  "recommended_days": número,
  "highlights": ["lugar1", "lugar2", "lugar3", "lugar4", "lugar5"],
  "cuisine": ["plato1", "plato2", "plato3"],
  "tips": ["consejo práctico 1", "consejo práctico 2"],
  "timezone": "Continent/City",
  "currency": "XXX",
  "language": "idioma principal"
}`

  let lastError: Error | null = null

  for (const model of OPENAI_MODELS) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        lastError = new Error(`OpenAI ${res.status}: ${await res.text()}`)
        continue
      }

      const json = await res.json()
      const raw = JSON.parse(json.choices[0].message.content)
      const parsed = destinationInfoSchema.safeParse(raw)

      if (!parsed.success) {
        lastError = new Error(`Schema inválido: ${JSON.stringify(parsed.error.flatten())}`)
        continue
      }

      return parsed.data
    } catch (err) {
      lastError = err as Error
    }
  }

  throw new Error(`OpenAI falló tras reintentos: ${lastError?.message}`)
}

// ─── Handler principal ────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Solo se admite POST', 405)
  }

  // Verificar autenticación
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED', 'Token de autenticación requerido', 401)
  }
  const token = authHeader.slice(7)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return errorResponse('UNAUTHORIZED', 'Token inválido o expirado', 401)
  }

  // Validar body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('INVALID_BODY', 'El body no es JSON válido', 400)
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('INVALID_INPUT', 'El campo destination es requerido', 422)
  }

  const { destination } = parsed.data
  const cacheKey = `destination_info_${destination.toLowerCase().trim()}`

  // Buscar en cache (7 días)
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString()
  const { data: cachedRow } = await supabase
    .from('itinerary_cache')
    .select('graph')
    .eq('cache_key', cacheKey)
    .gte('created_at', cutoff)
    .maybeSingle()

  if (cachedRow?.graph) {
    const info: DestinationInfo = { ...(cachedRow.graph as DestinationInfo), cached: true }
    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  // Verificar rate limit antes de llamar a OpenAI
  try {
    await checkAndIncrementUsage(user.id, supabase)
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return errorResponse('RATE_LIMIT_EXCEEDED', err.message, 429)
    }
    return errorResponse('INTERNAL_ERROR', 'Error al verificar límite de uso', 500)
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return errorResponse('MISSING_CONFIG', 'Configuración de IA no disponible', 503)
  }

  let info: DestinationInfo
  try {
    info = await callOpenAI(apiKey, destination)
  } catch (err) {
    return errorResponse('AI_UNAVAILABLE', `No se pudo obtener información: ${(err as Error).message}`, 503)
  }

  // Guardar en cache
  const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString()
  await supabase.from('itinerary_cache').upsert({
    cache_key: cacheKey,
    graph: info,
    expires_at: expires,
    destination: destination.trim(),
  })

  return new Response(JSON.stringify({ ...info, cached: false }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
})
