// Tests del módulo de conversión de moneda
// Cubre: convertCurrency (pura), fetchExchangeRates con caché, API y fallback estático

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const { mockGetItem, mockSetItem } = vi.hoisted(() => {
  const mockGetItem = vi.fn()
  const mockSetItem = vi.fn()
  return { mockGetItem, mockSetItem }
})

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: mockGetItem, setItem: mockSetItem },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// El hook useCurrencyConverter no se prueba aquí — requiere QueryClientProvider.
// Solo se prueban las funciones puras exportadas.
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))

import { fetchExchangeRates, convertCurrency } from '../lib/currencyConverter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Crea una entrada de caché serializada con timestamp dado
const makeCacheEntry = (rates: Record<string, number>, ageMs = 1_000) =>
  JSON.stringify({ base: 'USD', rates, timestamp: Date.now() - ageMs })

// Construye una respuesta simulada de la API de tasas de cambio
const makeApiResponse = (rates: Record<string, number> = { USD: 1, EUR: 0.91, GBP: 0.78 }) =>
  new Response(
    JSON.stringify({ result: 'success', base_code: 'USD', rates }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )

// ─── convertCurrency ──────────────────────────────────────────────────────────

describe('convertCurrency', () => {
  const RATES = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, MXN: 17.2 }

  it('retorna el mismo monto si from === to (identidad)', () => {
    expect(convertCurrency(100, 'USD', 'USD', RATES)).toBe(100)
    expect(convertCurrency(50, 'EUR', 'EUR', RATES)).toBe(50)
    expect(convertCurrency(0, 'GBP', 'GBP', RATES)).toBe(0)
  })

  it('convierte cero — el resultado siempre es cero', () => {
    expect(convertCurrency(0, 'USD', 'EUR', RATES)).toBe(0)
    expect(convertCurrency(0, 'EUR', 'GBP', RATES)).toBe(0)
    expect(convertCurrency(0, 'GBP', 'JPY', RATES)).toBe(0)
  })

  it('convierte USD → EUR correctamente (ruta directa: amount * rates[to])', () => {
    expect(convertCurrency(100, 'USD', 'EUR', RATES)).toBeCloseTo(92, 1)
    expect(convertCurrency(1, 'USD', 'EUR', RATES)).toBeCloseTo(0.92, 2)
  })

  it('convierte USD → JPY correctamente', () => {
    expect(convertCurrency(100, 'USD', 'JPY', RATES)).toBeCloseTo(14_950, 0)
  })

  it('convierte EUR → USD correctamente (ruta cruzada via pivot USD)', () => {
    // 92 EUR / 0.92 * 1 = 100 USD
    expect(convertCurrency(92, 'EUR', 'USD', RATES)).toBeCloseTo(100, 1)
  })

  it('convierte EUR → GBP correctamente (from→USD→to)', () => {
    // 100 EUR / 0.92 * 0.79 ≈ 85.87 GBP
    expect(convertCurrency(100, 'EUR', 'GBP', RATES)).toBeCloseTo(85.87, 1)
  })

  it('convierte MXN → EUR correctamente', () => {
    // 172 MXN / 17.2 * 0.92 = 9.2 EUR
    expect(convertCurrency(172, 'MXN', 'EUR', RATES)).toBeCloseTo(9.2, 1)
  })

  it('retorna el monto original si la moneda de origen no está en las tasas', () => {
    // !rateFrom → return amount (sin dividir entre undefined)
    expect(convertCurrency(100, 'XYZ', 'USD', RATES)).toBe(100)
    expect(convertCurrency(50, 'UNKNOWN', 'EUR', RATES)).toBe(50)
  })

  it('retorna el monto original si la moneda de destino no está en las tasas', () => {
    // rateFrom existe pero !rateTo → return amount
    expect(convertCurrency(100, 'EUR', 'ZZZ', RATES)).toBe(100)
  })

  it('retorna el monto original si ambas monedas son desconocidas', () => {
    expect(convertCurrency(100, 'XYZ', 'ABC', RATES)).toBe(100)
  })

  it('maneja montos grandes sin desbordamiento', () => {
    const result = convertCurrency(1_000_000, 'USD', 'JPY', RATES)
    expect(result).toBeCloseTo(149_500_000, -3)
  })
})

// ─── fetchExchangeRates — caché hit ──────────────────────────────────────────

describe('fetchExchangeRates — cache hit (AsyncStorage fresco)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('retorna las tasas del caché sin llamar a fetch cuando los datos son recientes', async () => {
    const cachedRates = { USD: 1, EUR: 0.93, GBP: 0.80 }
    mockGetItem.mockResolvedValue(makeCacheEntry(cachedRates, 60_000))  // 1 min de antigüedad
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const rates = await fetchExchangeRates()

    expect(rates.EUR).toBe(0.93)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('ignora el caché si el timestamp supera las 24 horas (expirado)', async () => {
    const expiredEntry = makeCacheEntry({ USD: 1, EUR: 0.50 }, 25 * 60 * 60 * 1_000)
    mockGetItem.mockResolvedValue(expiredEntry)
    const apiRates = { USD: 1, EUR: 0.91 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeApiResponse(apiRates)))

    const rates = await fetchExchangeRates()

    // Debe usar las tasas frescas de la API, no las del caché expirado
    expect(rates.EUR).toBe(0.91)
  })

  it('llama a la API cuando no hay datos en AsyncStorage', async () => {
    mockGetItem.mockResolvedValue(null)
    const mockFetch = vi.fn().mockResolvedValue(makeApiResponse())
    vi.stubGlobal('fetch', mockFetch)

    await fetchExchangeRates()

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('guarda las tasas de la API en AsyncStorage tras un fetch exitoso', async () => {
    mockGetItem.mockResolvedValue(null)
    const apiRates = { USD: 1, EUR: 0.91, GBP: 0.78 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeApiResponse(apiRates)))

    await fetchExchangeRates()

    expect(mockSetItem).toHaveBeenCalledOnce()
    const [key, value] = mockSetItem.mock.calls[0] as [string, string]
    expect(key).toContain('currency_rates')
    const parsed = JSON.parse(value) as { base: string; rates: Record<string, number>; timestamp: number }
    expect(parsed.base).toBe('USD')
    expect(parsed.rates).toMatchObject(apiRates)
    expect(parsed.timestamp).toBeGreaterThan(0)
  })
})

// ─── fetchExchangeRates — fallback estático ──────────────────────────────────

describe('fetchExchangeRates — fallback a tasas estáticas', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('retorna tasas de fallback si la red falla y no hay caché', async () => {
    mockGetItem.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const rates = await fetchExchangeRates()

    // FALLBACK_RATES: USD=1, EUR=0.92
    expect(rates.USD).toBe(1)
    expect(rates.EUR).toBe(0.92)
  })

  it('retorna tasas de fallback si la API responde con error HTTP (500)', async () => {
    mockGetItem.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    ))

    const rates = await fetchExchangeRates()

    expect(rates.USD).toBe(1)
    expect(rates.EUR).toBe(0.92)
  })

  it('retorna tasas de fallback si la API devuelve result !== "success"', async () => {
    mockGetItem.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: 'error', error_type: 'quota' }), { status: 200 })
    ))

    const rates = await fetchExchangeRates()

    expect(rates.USD).toBe(1)
  })

  it('las tasas de fallback cubren las monedas latinoamericanas principales', async () => {
    mockGetItem.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const rates = await fetchExchangeRates()

    expect(rates.MXN).toBeGreaterThan(0)
    expect(rates.BRL).toBeGreaterThan(0)
    expect(rates.ARS).toBeGreaterThan(0)
    expect(rates.CLP).toBeGreaterThan(0)
    expect(rates.PEN).toBeGreaterThan(0)
    expect(rates.COP).toBeGreaterThan(0)
  })

  it('no lanza si AsyncStorage también falla — retorna fallback graciosamente', async () => {
    mockGetItem.mockRejectedValue(new Error('Storage error'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const rates = await fetchExchangeRates()

    expect(rates.USD).toBe(1)
    expect(rates.EUR).toBe(0.92)
  })
})
