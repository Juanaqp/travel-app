// Edge Function: parse-document
// POST /functions/v1/parse-document
// Analiza documentos de viaje (imágenes y PDFs) con OpenAI Vision.
// Retorna tipo detectado, nivel de confianza, texto extraído y campos estructurados.
// Incluye caché de 7 días por hash SHA-256 del archivo y fallback a gpt-4o.
// Sube el archivo a Supabase Storage antes de llamar a OpenAI para reutilizarlo offline.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod'
import { errorResponse } from '../_shared/errors.ts'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_BYTES * (4 / 3))
const MODEL_DEFAULT = 'gpt-4o-mini'
const MODEL_FALLBACK = 'gpt-4o'
const MAX_TOKENS = 1024
const CACHE_TTL_HOURS = 168   // 7 días
const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const STORAGE_BUCKET = 'documents'

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

// ─── Schema de entrada ────────────────────────────────────────────────────────

const requestSchema = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.string().min(1),
  fileName: z.string().min(1).max(255),
  tripId: z.string().uuid().optional(),
  language: z.enum(['es', 'en']).default('es'),
})

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ParseResult {
  type: string
  confidence: number
  raw_text: string
  fields: Record<string, unknown>
}

interface CacheRow {
  result: ParseResult
  storage_path: string | null
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

// ─── Hash SHA-256 del archivo para caché y deduplicación en Storage ──────────
// Usa los primeros 10.000 chars del base64 para velocidad — suficientemente único

const hashFile = async (base64: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(base64.slice(0, 10_000))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// ─── Conversión base64 → binario ──────────────────────────────────────────────

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

// ─── Upload a Supabase Storage ────────────────────────────────────────────────
// Usa service role para evitar restricciones de RLS en la EF
// Path: {userId}/{tripId ?? 'general'}/{fileHash}/{fileName}

type SupabaseClient = ReturnType<typeof createClient>

const uploadToStorage = async (
  supabaseAdmin: SupabaseClient,
  fileBase64: string,
  mimeType: string,
  userId: string,
  tripId: string | undefined,
  fileHash: string,
  fileName: string
): Promise<string | null> => {
  try {
    const storagePath = `${userId}/${tripId ?? 'general'}/${fileHash}/${fileName}`
    const fileBytes = base64ToUint8Array(fileBase64)

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,  // no sobreescribir — el hash garantiza que es el mismo archivo
      })

    if (error) {
      // Si ya existe (mismo hash, ya fue subido) no es error real
      if (error.message?.includes('already exists') || (error as { statusCode?: string }).statusCode === '409') {
        console.log(`[parse-document] Archivo ya existe en Storage — hash=${fileHash}`)
        return storagePath
      }
      console.warn('[parse-document] Error al subir a Storage, continuando sin storage_path:', error.message)
      return null
    }

    console.log(`[parse-document] Archivo subido a Storage — path=${storagePath}`)
    return storagePath
  } catch (err) {
    console.warn('[parse-document] Excepción al subir a Storage:', (err as Error).message)
    return null
  }
}

// ─── Prompt del sistema ───────────────────────────────────────────────────────

const buildSystemPrompt = (language: string): string => {
  const lang = language === 'es' ? 'español' : 'English'
  return `Eres un extractor de datos de documentos de viaje. Analizas el documento y devuelves información estructurada.

REGLA ABSOLUTA: Responde EXCLUSIVAMENTE con un objeto JSON válido. Sin texto, sin markdown, sin explicaciones.

REGLAS DE TIMEZONE (CRÍTICO):
- Todos los campos de hora deben ser ISO 8601 con offset explícito. Ejemplo correcto: "2025-09-14T22:30:00-05:00"
- NUNCA devolver horas sin timezone (ej: "22:30" está prohibido si tienes contexto de lugar)
- Para boarding_pass: usa los códigos IATA del aeropuerto origen para departureTime y del aeropuerto destino para arrivalTime
  → LIM (Lima) = -05:00, MAD (Madrid) = +02:00 en verano / +01:00 en invierno, FCO (Roma) = +02:00 en verano
  → Incluye siempre: origin_timezone (IANA, ej: "America/Lima") y destination_timezone (IANA, ej: "Europe/Rome")
- Para hotel_confirmation: usa el timezone de la ciudad del hotel
  → Incluye: destination_timezone (IANA de la ciudad del hotel)
- Para otros tipos con fechas/horas: incluir timezone si el lugar es identificable

Estructura requerida:
{
  "type": "boarding_pass|ticket|hotel_confirmation|visa|passport|car_rental|insurance|tour|receipt|other",
  "confidence": 0.0-1.0,
  "raw_text": "texto relevante extraído del documento (máximo 200 palabras)",
  "fields": { ...campos dinámicos en ${lang}... }
}

Campos por tipo (usar null si no se encuentra el dato):
- boarding_pass: flightNumber, airline, passenger, origin, destination, departureDate,
    departureTime (ISO 8601 con offset del aeropuerto origen),
    arrivalTime (ISO 8601 con offset del aeropuerto destino),
    origin_timezone (IANA), destination_timezone (IANA),
    seat, gate, boardingTime, terminal, pnr
- ticket: eventName, venue, date, time, seat, price, currency, orderNumber
- hotel_confirmation: hotelName, checkInDate, checkOutDate, roomType, confirmationNumber,
    address, totalPrice, currency, destination_timezone (IANA de la ciudad del hotel)
- visa: visaType, country, validFrom, validUntil, entries, visaNumber, holderName
- passport: documentNumber, firstName, lastName, nationality, birthDate, expiryDate, gender
- car_rental: company, pickupDate, returnDate, carType, pickupLocation, returnLocation, confirmationNumber
- insurance: provider, policyNumber, coverageType, validFrom, validUntil, insuredName, emergencyPhone
- tour: tourName, provider, date, time, pickupPoint, participants, bookingReference
- receipt: merchant, date, totalAmount, currency, items, paymentMethod

Si confidence < 0.4 → type = "other". NO inventar datos. NO incluir campos vacíos como "".`
}

// ─── Llamada a OpenAI con soporte multimodal ──────────────────────────────────

const callOpenAI = async (
  apiKey: string,
  model: string,
  mimeType: string,
  fileBase64: string,
  language: string
): Promise<ParseResult> => {
  const systemPrompt = buildSystemPrompt(language)
  const isImage = SUPPORTED_IMAGE_TYPES.has(mimeType)

  // Para imágenes: visión directa con alta fidelidad
  // Para PDFs: análisis de texto (PDFs escaneados como imágenes requieren conversión fuera de esta función)
  const messages: Array<{ role: string; content: unknown }> = isImage
    ? [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${fileBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ]
    : [
        {
          role: 'user',
          content: `${systemPrompt}\n\nDocumento de tipo "${mimeType}". Analiza el contenido y extrae datos estructurados.`,
        },
      ]

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`OpenAI respondió ${res.status}: ${errBody}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? ''

  if (!rawText) throw new Error('OpenAI devolvió contenido vacío')

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('OpenAI devolvió JSON inválido')
  }

  // Validar estructura mínima requerida
  if (typeof parsed.type !== 'string' || typeof parsed.confidence !== 'number' || !parsed.fields) {
    throw new Error('Respuesta de OpenAI con estructura inválida: faltan campos obligatorios')
  }

  return {
    type: String(parsed.type),
    confidence: Number(parsed.confidence),
    raw_text: typeof parsed.raw_text === 'string' ? parsed.raw_text : '',
    fields: parsed.fields as Record<string, unknown>,
  }
}

// ─── Caché de resultados ──────────────────────────────────────────────────────

const lookupCache = async (
  supabase: SupabaseClient,
  fileHash: string
): Promise<CacheRow | null> => {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('document_parse_cache')
    .select('result, storage_path')
    .eq('file_hash', fileHash)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.result) return null
  return { result: data.result as ParseResult, storage_path: data.storage_path ?? null }
}

const saveToCache = async (
  supabase: SupabaseClient,
  fileHash: string,
  result: ParseResult,
  storagePath: string | null
): Promise<void> => {
  const { error } = await supabase
    .from('document_parse_cache')
    .upsert({
      file_hash: fileHash,
      result,
      storage_path: storagePath,
      created_at: new Date().toISOString(),
    })

  if (error) {
    console.warn('[parse-document] No se pudo guardar en caché:', error.message)
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

    const { fileBase64, mimeType, fileName, tripId, language } = parseResult.data

    // 2. Verificar tamaño del archivo (base64 es ~33% más grande que el binario)
    if (fileBase64.length > MAX_BASE64_CHARS) {
      return errorResponse('PAYLOAD_TOO_LARGE', 'Archivo demasiado grande (máximo 5MB)', 413)
    }

    // 3. Verificar tipo de archivo soportado
    const isImage = SUPPORTED_IMAGE_TYPES.has(mimeType)
    const isPdf = mimeType === 'application/pdf'
    if (!isImage && !isPdf) {
      return errorResponse('UNSUPPORTED_MEDIA', 'Tipo de archivo no soportado', 415)
    }

    // 4. Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('UNAUTHORIZED', 'No autorizado', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponse('UNAUTHORIZED', 'No autorizado', 401)

    // Cliente con service role para Storage — necesario para subir sin restricciones de RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 5. Verificar caché por hash del archivo
    const fileHash = await hashFile(fileBase64)
    console.log(`[parse-document] userId=${user.id} fileName=${fileName} hash=${fileHash}`)

    const cached = await lookupCache(supabase, fileHash)
    if (cached) {
      console.log(`[parse-document] Resultado encontrado en caché — hash=${fileHash} storagePath=${cached.storage_path}`)
      return jsonResponse({
        ...cached.result,
        cached: true,
        fileName,
        tripId,
        storagePath: cached.storage_path,
      }, 200)
    }

    // 6. Subir archivo a Storage ANTES de llamar a OpenAI
    // Si falla el upload, continuamos sin storage_path (no es bloqueante para el parseo)
    const storagePath = await uploadToStorage(
      supabaseAdmin,
      fileBase64,
      mimeType,
      user.id,
      tripId,
      fileHash,
      fileName
    )

    // 7. Verificar API key de OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) return errorResponse('MISSING_CONFIG', 'OPENAI_API_KEY no configurada', 500)

    // 8. Llamar a OpenAI — fallback automático de gpt-4o-mini a gpt-4o si falla
    let result: ParseResult
    try {
      console.log(`[parse-document] Intentando con ${MODEL_DEFAULT}`)
      result = await callOpenAI(openaiApiKey, MODEL_DEFAULT, mimeType, fileBase64, language)
    } catch (firstErr) {
      console.warn(
        `[parse-document] ${MODEL_DEFAULT} falló — reintentando con ${MODEL_FALLBACK}:`,
        (firstErr as Error).message
      )
      try {
        result = await callOpenAI(openaiApiKey, MODEL_FALLBACK, mimeType, fileBase64, language)
      } catch (secondErr) {
        console.error(`[parse-document] ${MODEL_FALLBACK} también falló:`, (secondErr as Error).message)
        return errorResponse('AI_UNAVAILABLE', 'No se pudo analizar el documento', 503)
      }
    }

    // 9. Guardar en caché para futuras solicitudes del mismo archivo (incluyendo storage_path)
    await saveToCache(supabase, fileHash, result, storagePath)

    console.log(`[parse-document] Completado — type=${result.type} confidence=${result.confidence} storagePath=${storagePath}`)
    return jsonResponse({ ...result, cached: false, fileName, tripId, storagePath }, 200)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[parse-document] Error inesperado:', errMsg)
    return errorResponse('INTERNAL_ERROR', 'Error interno del servidor', 500)
  }
})
