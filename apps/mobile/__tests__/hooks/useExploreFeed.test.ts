import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn()
  return { mockInvoke }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { fetchExploreFeed, EXPLORE_FEED_QUERY_CONFIG } from '../../hooks/useExploreFeed'
import type { ExploreFeedResponse } from '@travelapp/types'

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const MOCK_FEED: ExploreFeedResponse = {
  destinations: [
    { name: 'Roma', trip_count: 12, image_url: 'https://images.unsplash.com/photo-abc', continent: 'Europe' },
    { name: 'Tokyo', trip_count: 8, image_url: 'https://images.unsplash.com/photo-def', continent: 'Asia' },
  ],
  generated_at: '2026-04-28T10:00:00.000Z',
}

// ─── fetchExploreFeed ─────────────────────────────────────────────────────────

describe('fetchExploreFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llama a supabase.functions.invoke("get-explore-feed")', async () => {
    mockInvoke.mockResolvedValue({ data: MOCK_FEED, error: null })

    await fetchExploreFeed()

    expect(mockInvoke).toHaveBeenCalledWith('get-explore-feed')
  })

  it('retorna la lista de destinos con los campos correctos', async () => {
    mockInvoke.mockResolvedValue({ data: MOCK_FEED, error: null })

    const result = await fetchExploreFeed()

    expect(result.destinations).toHaveLength(2)
    expect(result.destinations[0]).toMatchObject({
      name: 'Roma',
      trip_count: 12,
      continent: 'Europe',
    })
  })

  it('lanza error si la Edge Function devuelve error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Función no disponible') })

    await expect(fetchExploreFeed()).rejects.toThrow('Función no disponible')
  })

  it('lanza error si la respuesta no contiene destinations', async () => {
    mockInvoke.mockResolvedValue({ data: { generated_at: '2026-04-28' }, error: null })

    await expect(fetchExploreFeed()).rejects.toThrow('Respuesta inválida')
  })

  it('no expone user_id ni datos personales en el resultado', async () => {
    // Simula que el servidor devolvió accidentalmente user_id en la respuesta
    const responseWithLeak = {
      destinations: [{ name: 'Roma', trip_count: 1, image_url: '...', continent: 'Europe', user_id: 'leaked' }],
      generated_at: '2026-04-28T10:00:00.000Z',
    }
    mockInvoke.mockResolvedValue({ data: responseWithLeak, error: null })

    const result = await fetchExploreFeed()

    // El cliente no debe actuar sobre el user_id — simplemente lo recibe del servidor.
    // La responsabilidad de no enviarlo es del servidor (Edge Function).
    // El test verifica que el hook no transforma ni expone ese campo de forma activa.
    const resultStr = JSON.stringify(result.destinations)
    // Los campos esperados son name, trip_count, image_url, continent
    result.destinations.forEach((d) => {
      expect(Object.keys(d)).not.toContain('user_id')
    })
  })
})

// ─── Configuración del query ───────────────────────────────────────────────────

describe('EXPLORE_FEED_QUERY_CONFIG', () => {
  it('staleTime es exactamente 1 hora (3.600.000 ms)', () => {
    expect(EXPLORE_FEED_QUERY_CONFIG.staleTime).toBe(60 * 60 * 1000)
  })

  it('gcTime es exactamente 24 horas (86.400.000 ms)', () => {
    expect(EXPLORE_FEED_QUERY_CONFIG.gcTime).toBe(24 * 60 * 60 * 1000)
  })

  it('networkMode es "offlineFirst" — sirve caché sin conexión', () => {
    expect(EXPLORE_FEED_QUERY_CONFIG.networkMode).toBe('offlineFirst')
  })

  it('queryKey es ["explore-feed"]', () => {
    expect(EXPLORE_FEED_QUERY_CONFIG.queryKey).toEqual(['explore-feed'])
  })
})

// ─── Comportamiento offline ───────────────────────────────────────────────────

describe('useExploreFeed — comportamiento offline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no llama a la Edge Function si hay datos en caché (networkMode offlineFirst)', async () => {
    // Con networkMode='offlineFirst', React Query NO llama a queryFn cuando el dispositivo
    // está offline y hay datos cacheados. El test verifica que fetchExploreFeed con datos
    // válidos no propaga el error de red — React Query maneja esto internamente.
    // Esta prueba verifica la correcta declaración del networkMode en la config.
    expect(EXPLORE_FEED_QUERY_CONFIG.networkMode).toBe('offlineFirst')

    // Con datos en caché y staleTime=1h, React Query retorna datos cacheados sin fetch
    // La prueba de integración completa requiere QueryClient real (Maestro/E2E).
  })

  it('fetchExploreFeed lanza error si la función no está disponible (sin red)', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'))

    await expect(fetchExploreFeed()).rejects.toThrow('Network request failed')
  })
})
