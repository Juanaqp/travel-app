// Conversor de moneda con caché en AsyncStorage (TTL: 24h)
// Fuente de tasas: open.er-api.com (sin API key requerida para el plan gratuito)
// En producción: reemplazar con EXCHANGERATE_API_KEY si se supera el límite de requests

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { logger } from '@/lib/logger'

const RATES_CACHE_KEY = '@travelapp_currency_rates_v1'
const RATES_TTL_MS = 24 * 60 * 60 * 1000       // 24 horas
const RATES_API_URL = 'https://open.er-api.com/v6/latest/USD'

// Tasas de fallback estáticas — se usan si no hay conexión y no hay caché
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.89,
  CNY: 7.24,
  MXN: 17.2,
  BRL: 5.0,
  ARS: 900,
  CLP: 950,
  COP: 4100,
  PEN: 3.76,
  UYU: 38.5,
  BOB: 6.9,
  PYG: 7400,
  VES: 36.5,
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RatesCache {
  base: 'USD'
  rates: Record<string, number>
  timestamp: number
}

interface ApiResponse {
  result: string
  base_code: string
  rates: Record<string, number>
  time_last_update_unix: number
}

// ─── Caché en AsyncStorage ────────────────────────────────────────────────────

const readCachedRates = async (): Promise<RatesCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(RATES_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RatesCache
    const isExpired = Date.now() - parsed.timestamp > RATES_TTL_MS
    return isExpired ? null : parsed
  } catch {
    return null
  }
}

const writeCachedRates = async (cache: RatesCache): Promise<void> => {
  try {
    await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    logger.warn('No se pudo guardar tasas de cambio en caché', { error })
  }
}

// ─── Fetch de tasas ───────────────────────────────────────────────────────────

export const fetchExchangeRates = async (): Promise<Record<string, number>> => {
  // 1. Intentar leer desde caché local primero
  const cached = await readCachedRates()
  if (cached) {
    logger.info('Tasas de cambio desde caché', { age: Date.now() - cached.timestamp })
    return cached.rates
  }

  // 2. Fetch desde la API pública
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(RATES_API_URL, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) throw new Error(`API respondió ${res.status}`)

    const data = await res.json() as ApiResponse
    if (data.result !== 'success') throw new Error('API devolvió resultado no exitoso')

    const newCache: RatesCache = {
      base: 'USD',
      rates: data.rates,
      timestamp: Date.now(),
    }

    await writeCachedRates(newCache)
    logger.info('Tasas de cambio actualizadas desde API', { baseCurrency: 'USD' })
    return data.rates
  } catch (error) {
    logger.warn('No se pudieron obtener tasas de cambio — usando fallback', { error })
    return FALLBACK_RATES
  }
}

// ─── Conversión de moneda ─────────────────────────────────────────────────────

// Convierte un monto entre dos monedas usando USD como moneda pivot
export const convertCurrency = (
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number => {
  if (from === to) return amount
  if (from === 'USD') return amount * (rates[to] ?? 1)

  // Convertir primero a USD y luego a la moneda objetivo
  const rateFrom = rates[from]
  const rateTo = rates[to]
  if (!rateFrom || !rateTo) return amount

  return (amount / rateFrom) * rateTo
}

// ─── Hook de React Query ──────────────────────────────────────────────────────

interface UseCurrencyConverterResult {
  rates: Record<string, number>
  isLoading: boolean
  convert: (amount: number, from: string, to: string) => number
}

export const useCurrencyConverter = (): UseCurrencyConverterResult => {
  const { data: rates = FALLBACK_RATES, isLoading } = useQuery({
    queryKey: ['currency_rates'],
    queryFn: fetchExchangeRates,
    staleTime: RATES_TTL_MS,
    retry: 1,
    gcTime: RATES_TTL_MS * 2,
  })

  const convert = (amount: number, from: string, to: string): number =>
    convertCurrency(amount, from, to, rates)

  return { rates, isLoading, convert }
}
