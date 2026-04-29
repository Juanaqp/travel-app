// Tests de la Edge Function parse-expense
// Los helpers viven en un módulo Deno (no importable en Node), así que se
// re-implementa la misma lógica aquí para testearla de forma aislada.
// Cubre: requestSchema, hashText (SHA-256), buildSystemPrompt (fecha), normalización de respuesta OpenAI

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ─── Reimplementación local de los helpers para tests ────────────────────────

const MAX_TEXT_LENGTH = 1000

// Idéntico al schema de la Edge Function
const requestSchema = z.object({
  text: z.string().min(3).max(MAX_TEXT_LENGTH),
  tripId: z.string().uuid().optional(),
  language: z.enum(['es', 'en']).default('es'),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// Idéntico a hashText — SHA-256 del texto normalizado, primeros 32 chars
const hashText = async (text: string): Promise<string> => {
  const encoder = new TextEncoder()
  const normalized = text.toLowerCase().trim()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// Captura la lógica de fecha relativa de buildSystemPrompt (la parte crítica)
const buildSystemPrompt = (language: string, currentDate: string): string => {
  const d = new Date(currentDate)
  d.setDate(d.getDate() - 1)
  const yesterday = d.toISOString().slice(0, 10)
  const langNote = language === 'es' ? 'El usuario habla en español' : 'The user speaks English'
  return `Fecha actual: ${currentDate}. Ayer: ${yesterday}. ${langNote}.`
}

// Idéntico al parsing y normalización que hace callOpenAI antes de retornar
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

const normalizeOpenAIResponse = (rawContent: string, fallbackText: string): ParseResult => {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawContent) as Record<string, unknown>
  } catch {
    throw new Error('OpenAI devolvió JSON inválido')
  }

  if (parsed.type !== 'expense' || typeof parsed.confidence !== 'number' || !parsed.fields) {
    throw new Error('Respuesta de OpenAI con estructura inválida: faltan campos obligatorios')
  }

  const fields = parsed.fields as Record<string, unknown>

  return {
    type: 'expense',
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence))),
    raw_text: typeof parsed.raw_text === 'string' ? parsed.raw_text : fallbackText,
    fields: {
      amount: typeof fields.amount === 'number' ? fields.amount : null,
      currency: typeof fields.currency === 'string' && fields.currency ? fields.currency : null,
      category: typeof fields.category === 'string' && fields.category ? fields.category : null,
      title: typeof fields.title === 'string' && fields.title ? fields.title : null,
      date: typeof fields.date === 'string' && fields.date ? fields.date : null,
    },
  }
}

// ─── requestSchema ────────────────────────────────────────────────────────────

describe('requestSchema — validación de entradas', () => {
  it('acepta body mínimo válido (solo text con 3+ chars)', () => {
    const result = requestSchema.safeParse({ text: 'Taxi al aeropuerto 25 EUR' })
    expect(result.success).toBe(true)
  })

  it('rechaza text vacío', () => {
    expect(requestSchema.safeParse({ text: '' }).success).toBe(false)
  })

  it('rechaza text de menos de 3 caracteres', () => {
    expect(requestSchema.safeParse({ text: 'AB' }).success).toBe(false)
    expect(requestSchema.safeParse({ text: 'A' }).success).toBe(false)
  })

  it('acepta text de exactamente 3 caracteres (límite inferior)', () => {
    expect(requestSchema.safeParse({ text: 'ABC' }).success).toBe(true)
  })

  it('rechaza text que supera MAX_TEXT_LENGTH (1000 chars)', () => {
    const tooLong = 'A'.repeat(1001)
    expect(requestSchema.safeParse({ text: tooLong }).success).toBe(false)
  })

  it('acepta text de exactamente 1000 chars (límite superior)', () => {
    const maxLen = 'A'.repeat(1000)
    expect(requestSchema.safeParse({ text: maxLen }).success).toBe(true)
  })

  it('language tiene default "es" si no se provee', () => {
    const result = requestSchema.safeParse({ text: 'Cena en Madrid 30€' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.language).toBe('es')
  })

  it('acepta language "en"', () => {
    const result = requestSchema.safeParse({ text: 'Dinner in London 40 GBP', language: 'en' })
    expect(result.success).toBe(true)
  })

  it('rechaza language no soportado', () => {
    expect(requestSchema.safeParse({ text: 'texto válido', language: 'fr' }).success).toBe(false)
    expect(requestSchema.safeParse({ text: 'texto válido', language: 'pt' }).success).toBe(false)
  })

  it('acepta tripId como UUID v4 válido', () => {
    const result = requestSchema.safeParse({
      text: 'Hotel Marriott 150 USD',
      tripId: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza tripId que no sea UUID válido', () => {
    expect(requestSchema.safeParse({ text: 'Hotel 100 USD', tripId: 'no-es-uuid' }).success).toBe(false)
    expect(requestSchema.safeParse({ text: 'Hotel 100 USD', tripId: '12345' }).success).toBe(false)
  })

  it('tripId es opcional — se acepta sin él', () => {
    const result = requestSchema.safeParse({ text: 'Taxi 25 EUR' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.tripId).toBeUndefined()
  })

  it('acepta currentDate con formato YYYY-MM-DD', () => {
    expect(requestSchema.safeParse({ text: 'Almuerzo 15 EUR', currentDate: '2026-04-29' }).success).toBe(true)
  })

  it('rechaza currentDate con formato incorrecto', () => {
    expect(requestSchema.safeParse({ text: 'texto', currentDate: '29/04/2026' }).success).toBe(false)
    expect(requestSchema.safeParse({ text: 'texto', currentDate: '2026-4-9' }).success).toBe(false)
    expect(requestSchema.safeParse({ text: 'texto', currentDate: 'hoy' }).success).toBe(false)
  })
})

// ─── hashText ─────────────────────────────────────────────────────────────────

describe('hashText — SHA-256 para caché de resultados', () => {
  it('devuelve una cadena hexadecimal de 32 caracteres', async () => {
    const hash = await hashText('Taxi al aeropuerto 25 EUR')
    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('es determinista — el mismo texto siempre produce el mismo hash', async () => {
    const text = 'Cena en Roma 45 EUR'
    const hash1 = await hashText(text)
    const hash2 = await hashText(text)
    expect(hash1).toBe(hash2)
  })

  it('normaliza a minúsculas — mayúsculas y minúsculas producen el mismo hash', async () => {
    const hashUpper = await hashText('TAXI 25 EUR')
    const hashLower = await hashText('taxi 25 eur')
    expect(hashUpper).toBe(hashLower)
  })

  it('normaliza espacios extremos (trim) — el padding no afecta el hash', async () => {
    const hashPadded = await hashText('  almuerzo 30 EUR  ')
    const hashClean = await hashText('almuerzo 30 EUR')
    expect(hashPadded).toBe(hashClean)
  })

  it('textos distintos producen hashes distintos', async () => {
    const hash1 = await hashText('Taxi 25 EUR')
    const hash2 = await hashText('Taxi 26 EUR')
    expect(hash1).not.toBe(hash2)
  })

  it('textos muy cortos producen hashes válidos sin error', async () => {
    const hash = await hashText('ok')
    expect(hash).toHaveLength(32)
  })
})

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt — construcción del prompt de sistema', () => {
  it('incluye la fecha actual en el prompt', () => {
    const prompt = buildSystemPrompt('es', '2026-04-29')
    expect(prompt).toContain('2026-04-29')
  })

  it('calcula ayer correctamente como currentDate menos 1 día', () => {
    const prompt = buildSystemPrompt('es', '2026-04-29')
    expect(prompt).toContain('2026-04-28')
  })

  it('calcula ayer correctamente al cruzar el límite de mes', () => {
    const prompt = buildSystemPrompt('es', '2026-05-01')
    expect(prompt).toContain('2026-04-30')  // último día de abril
  })

  it('calcula ayer correctamente al cruzar el límite de año', () => {
    const prompt = buildSystemPrompt('es', '2026-01-01')
    expect(prompt).toContain('2025-12-31')  // último día del año anterior
  })

  it('incluye nota de idioma en español para language="es"', () => {
    const prompt = buildSystemPrompt('es', '2026-04-29')
    expect(prompt).toContain('español')
  })

  it('incluye nota de idioma en inglés para language="en"', () => {
    const prompt = buildSystemPrompt('en', '2026-04-29')
    expect(prompt).toContain('English')
  })
})

// ─── normalizeOpenAIResponse — parsing y normalización ───────────────────────

describe('normalizeOpenAIResponse — parsing de respuesta de OpenAI', () => {
  // Helper para construir respuestas válidas
  const makeValidResponse = (overrides: Record<string, unknown> = {}): string =>
    JSON.stringify({
      type: 'expense',
      confidence: 0.95,
      raw_text: 'Taxi al aeropuerto 25 EUR',
      fields: {
        amount: 25,
        currency: 'EUR',
        category: 'transport',
        title: 'Taxi al aeropuerto',
        date: '2026-04-29',
      },
      ...overrides,
    })

  it('parsea una respuesta válida y devuelve la estructura esperada', () => {
    const result = normalizeOpenAIResponse(makeValidResponse(), 'fallback')
    expect(result).toMatchObject({
      type: 'expense',
      confidence: 0.95,
      raw_text: 'Taxi al aeropuerto 25 EUR',
      fields: {
        amount: 25,
        currency: 'EUR',
        category: 'transport',
        title: 'Taxi al aeropuerto',
        date: '2026-04-29',
      },
    })
  })

  it('clampea confidence a 1.0 si OpenAI devuelve valor mayor', () => {
    const result = normalizeOpenAIResponse(makeValidResponse({ confidence: 1.5 }), 'text')
    expect(result.confidence).toBe(1)
  })

  it('clampea confidence a 0 si OpenAI devuelve valor negativo', () => {
    const result = normalizeOpenAIResponse(makeValidResponse({ confidence: -0.2 }), 'text')
    expect(result.confidence).toBe(0)
  })

  it('usa fallbackText como raw_text si OpenAI no devuelve ese campo', () => {
    const response = JSON.stringify({
      type: 'expense',
      confidence: 0.8,
      // sin raw_text
      fields: { amount: 30, currency: 'USD', category: 'food', title: 'Almuerzo', date: null },
    })
    const result = normalizeOpenAIResponse(response, 'mi texto original')
    expect(result.raw_text).toBe('mi texto original')
  })

  it('convierte amount no numérico a null', () => {
    const response = makeValidResponse({
      fields: { amount: 'no-es-número', currency: 'USD', category: 'food', title: 'Algo', date: null },
    })
    const result = normalizeOpenAIResponse(response, 'text')
    expect(result.fields.amount).toBeNull()
  })

  it('convierte currency string vacío a null', () => {
    const response = makeValidResponse({
      fields: { amount: 30, currency: '', category: 'food', title: 'Algo', date: null },
    })
    const result = normalizeOpenAIResponse(response, 'text')
    expect(result.fields.currency).toBeNull()
  })

  it('convierte category null a null (no falla)', () => {
    const response = makeValidResponse({
      fields: { amount: 30, currency: 'USD', category: null, title: 'Algo', date: null },
    })
    const result = normalizeOpenAIResponse(response, 'text')
    expect(result.fields.category).toBeNull()
  })

  it('convierte title de tipo no string a null', () => {
    const response = makeValidResponse({
      fields: { amount: 30, currency: 'USD', category: 'food', title: 42, date: null },
    })
    const result = normalizeOpenAIResponse(response, 'text')
    expect(result.fields.title).toBeNull()
  })

  it('conserva date válida en formato ISO', () => {
    const result = normalizeOpenAIResponse(makeValidResponse(), 'text')
    expect(result.fields.date).toBe('2026-04-29')
  })

  it('lanza error si type no es "expense"', () => {
    const response = makeValidResponse({ type: 'income' })
    expect(() => normalizeOpenAIResponse(response, 'text')).toThrow('estructura inválida')
  })

  it('lanza error si falta el campo confidence', () => {
    const response = JSON.stringify({
      type: 'expense',
      // sin confidence
      fields: { amount: 100, currency: 'USD', category: 'food', title: 'Test', date: null },
    })
    expect(() => normalizeOpenAIResponse(response, 'text')).toThrow('estructura inválida')
  })

  it('lanza error si falta el campo fields', () => {
    const response = JSON.stringify({ type: 'expense', confidence: 0.9 })
    expect(() => normalizeOpenAIResponse(response, 'text')).toThrow('estructura inválida')
  })

  it('lanza error si OpenAI devuelve JSON inválido (no parseable)', () => {
    expect(() => normalizeOpenAIResponse('esto no es JSON {{{', 'text')).toThrow('JSON inválido')
  })
})
