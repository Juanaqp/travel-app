import { describe, it, expect } from 'vitest'

// Los helpers de la Edge Function viven en un módulo Deno (no importable en Node).
// Re-implementamos la misma lógica aquí para testearla de forma aislada y documentar
// el comportamiento esperado con contrato de tipos.

// ─── Reimplementación local de los helpers para tests ────────────────────────

type Continent = 'Europe' | 'Asia' | 'Americas' | 'Africa' | 'Oceania' | 'Middle East'

const DESTINATION_IMAGES: Record<string, { image_url: string; continent: Continent }> = {
  'Roma':        { image_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80&auto=format', continent: 'Europe' },
  'París':       { image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80&auto=format', continent: 'Europe' },
  'Tokyo':       { image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80&auto=format', continent: 'Asia'   },
  'Barcelona':   { image_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&q=80&auto=format', continent: 'Europe' },
  'Nueva York':  { image_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80&auto=format', continent: 'Americas' },
}

const GENERIC_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80&auto=format'

const getDestinationMetaLocal = (name: string) =>
  DESTINATION_IMAGES[name] ?? { image_url: GENERIC_IMAGE, continent: 'Europe' as Continent }

// Lógica de agrupación idéntica a la de la Edge Function
const groupByDestinationLocal = (
  rows: Array<{ destination: string | null }>,
  limit = 20
): Array<{ name: string; trip_count: number }> => {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    if (row.destination) {
      counts[row.destination] = (counts[row.destination] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, trip_count]) => ({ name, trip_count }))
}

// Rate limiter local para tests (misma lógica que la Edge Function)
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 60_000

interface IpEntry { count: number; windowStart: number }
const createRateLimiter = () => {
  const map = new Map<string, IpEntry>()
  return (ip: string): boolean => {
    const now = Date.now()
    const entry = map.get(ip)
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      map.set(ip, { count: 1, windowStart: now })
      return true
    }
    if (entry.count >= RATE_LIMIT_MAX) return false
    entry.count++
    return true
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('groupByDestination', () => {
  it('agrupa correctamente los registros por destino', () => {
    const rows = [
      { destination: 'Roma' },
      { destination: 'Roma' },
      { destination: 'París' },
      { destination: 'Tokyo' },
      { destination: 'Roma' },
    ]

    const result = groupByDestinationLocal(rows)

    expect(result[0]).toEqual({ name: 'Roma', trip_count: 3 })
    expect(result[1]).toEqual({ name: 'París', trip_count: 1 })
    expect(result[2]).toEqual({ name: 'Tokyo', trip_count: 1 })
  })

  it('ignora filas con destination null', () => {
    const rows = [
      { destination: 'Roma' },
      { destination: null },
      { destination: null },
    ]

    const result = groupByDestinationLocal(rows)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Roma')
  })

  it('devuelve máximo 20 destinos aunque haya más', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ destination: `Destino${i}` }))

    const result = groupByDestinationLocal(rows)

    expect(result.length).toBeLessThanOrEqual(20)
  })

  it('ordena por trip_count descendente', () => {
    const rows = [
      { destination: 'A' },
      { destination: 'B' }, { destination: 'B' }, { destination: 'B' },
      { destination: 'C' }, { destination: 'C' },
    ]

    const result = groupByDestinationLocal(rows)

    expect(result[0].name).toBe('B')
    expect(result[1].name).toBe('C')
    expect(result[2].name).toBe('A')
  })
})

describe('getDestinationMeta — mapeo de imágenes', () => {
  it('devuelve la imagen correcta para destinos conocidos', () => {
    const meta = getDestinationMetaLocal('Roma')

    expect(meta.image_url).toContain('unsplash.com')
    expect(meta.continent).toBe('Europe')
  })

  it('devuelve imagen genérica para destinos desconocidos', () => {
    const meta = getDestinationMetaLocal('Guadalajara Inventada')

    expect(meta.image_url).toBe(GENERIC_IMAGE)
  })

  it('no expone user_id ni datos personales en el output', () => {
    const rows = [
      { destination: 'Roma', user_id: 'user-secret-123' },
      { destination: 'Roma', user_id: 'user-secret-456' },
    ]

    // Solo se deben procesar campos "destination" — groupBy ignora cualquier otra columna
    const result = groupByDestinationLocal(rows as never)

    const resultStr = JSON.stringify(result)
    expect(resultStr).not.toContain('user-secret-123')
    expect(resultStr).not.toContain('user-secret-456')
    expect(resultStr).not.toContain('user_id')
  })
})

describe('checkIpRateLimit', () => {
  it('permite las primeras 60 requests de una IP en un minuto', () => {
    const checkRate = createRateLimiter()

    for (let i = 0; i < 60; i++) {
      expect(checkRate('192.168.1.1')).toBe(true)
    }
  })

  it('bloquea la request 61 de la misma IP en la misma ventana', () => {
    const checkRate = createRateLimiter()

    for (let i = 0; i < 60; i++) {
      checkRate('10.0.0.1')
    }

    expect(checkRate('10.0.0.1')).toBe(false)
  })

  it('IPs distintas no se afectan entre sí', () => {
    const checkRate = createRateLimiter()

    for (let i = 0; i < 60; i++) {
      checkRate('1.1.1.1')
    }

    // IP diferente — contador independiente
    expect(checkRate('2.2.2.2')).toBe(true)
  })
})
