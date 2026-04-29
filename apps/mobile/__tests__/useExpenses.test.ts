// Tests del módulo de gastos
// Cubre: mapeo de filas, cálculo de totales, parseo de texto con IA, fetch y mutaciones

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const { mockGetUser, mockFrom, mockFunctionsInvoke } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockFunctionsInvoke = vi.fn()
  return { mockGetUser, mockFrom, mockFunctionsInvoke }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/notifications', () => ({
  scheduleBudgetAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/offline/reader', () => ({
  saveExpensesOffline: vi.fn().mockResolvedValue(undefined),
  getExpensesOffline: vi.fn().mockResolvedValue([]),
}))

// Importar funciones puras DESPUÉS de los mocks
import {
  mapRowToExpense,
  computeExpenseTotals,
  fetchExpenses,
  createExpense,
  archiveExpense,
  parseExpenseText,
} from '../hooks/useExpenses'
import { convertCurrency } from '../lib/currencyConverter'
import type { ParseExpenseResult } from '@travelapp/types'

// ─── Helpers de encadenamiento ────────────────────────────────────────────────

// Crea un mock thenable que resuelve al valor dado al hacer await
const createQueryChain = (result: { data: unknown; error: unknown }) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  then: (resolve: (val: typeof result) => unknown) => Promise.resolve(result).then(resolve),
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AUTH_USER = { id: 'user-xyz', email: 'test@example.com' }

const MOCK_EXPENSE_ROW_FOOD = {
  id: 'exp-001',
  trip_id: 'trip-abc',
  user_id: 'user-xyz',
  description: 'Cena en Roma',
  amount: '40.00',
  currency: 'EUR',
  amount_in_base_currency: '43.50',
  category: 'food',
  input_method: 'ai_parsed',
  spent_at: '2026-05-10T20:00:00Z',
  location: 'Roma, Italia',
  notes: null,
  receipt_storage_path: null,
  deleted_at: null,
  created_at: '2026-05-10T20:30:00Z',
  updated_at: '2026-05-10T20:30:00Z',
}

const MOCK_EXPENSE_ROW_TRANSPORT = {
  id: 'exp-002',
  trip_id: 'trip-abc',
  user_id: 'user-xyz',
  description: 'Taxi al aeropuerto',
  amount: '25.00',
  currency: 'EUR',
  amount_in_base_currency: '27.20',
  category: 'transport',
  input_method: 'manual',
  spent_at: '2026-05-10T09:00:00Z',
  location: null,
  notes: 'Viaje de vuelta',
  receipt_storage_path: null,
  deleted_at: null,
  created_at: '2026-05-10T09:15:00Z',
  updated_at: '2026-05-10T09:15:00Z',
}

// ─── mapRowToExpense ──────────────────────────────────────────────────────────

describe('mapRowToExpense', () => {
  it('convierte todos los campos correctamente', () => {
    const result = mapRowToExpense(MOCK_EXPENSE_ROW_FOOD)
    expect(result.id).toBe('exp-001')
    expect(result.tripId).toBe('trip-abc')
    expect(result.userId).toBe('user-xyz')
    expect(result.description).toBe('Cena en Roma')
    expect(result.amount).toBe(40)
    expect(result.currency).toBe('EUR')
    expect(result.amountInBaseCurrency).toBe(43.5)
    expect(result.category).toBe('food')
    expect(result.inputMethod).toBe('ai_parsed')
    expect(result.location).toBe('Roma, Italia')
    expect(result.deletedAt).toBeNull()
  })

  it('convierte amount_in_base_currency nulo a undefined', () => {
    const row = { ...MOCK_EXPENSE_ROW_FOOD, amount_in_base_currency: null }
    const result = mapRowToExpense(row)
    expect(result.amountInBaseCurrency).toBeUndefined()
  })

  it('convierte location nulo a undefined', () => {
    const result = mapRowToExpense(MOCK_EXPENSE_ROW_TRANSPORT)
    expect(result.location).toBeUndefined()
  })

  it('convierte notes nulo a undefined', () => {
    const result = mapRowToExpense(MOCK_EXPENSE_ROW_FOOD)
    expect(result.notes).toBeUndefined()
  })

  it('convierte amount string a número', () => {
    const row = { ...MOCK_EXPENSE_ROW_FOOD, amount: '123.45' }
    const result = mapRowToExpense(row)
    expect(result.amount).toBe(123.45)
    expect(typeof result.amount).toBe('number')
  })
})

// ─── computeExpenseTotals ─────────────────────────────────────────────────────

describe('computeExpenseTotals', () => {
  const foodExpense = mapRowToExpense(MOCK_EXPENSE_ROW_FOOD)
  const transportExpense = mapRowToExpense(MOCK_EXPENSE_ROW_TRANSPORT)

  it('calcula total correctamente', () => {
    const totals = computeExpenseTotals([foodExpense, transportExpense])
    expect(totals.total).toBe(65)
    expect(totals.count).toBe(2)
  })

  it('agrupa correctamente por categoría', () => {
    const totals = computeExpenseTotals([foodExpense, transportExpense])
    expect(totals.byCategory.food).toBe(40)
    expect(totals.byCategory.transport).toBe(25)
  })

  it('retorna cero para lista vacía', () => {
    const totals = computeExpenseTotals([])
    expect(totals.total).toBe(0)
    expect(totals.count).toBe(0)
  })

  it('acumula múltiples gastos de la misma categoría', () => {
    const second = { ...foodExpense, id: 'exp-003', amount: 15 }
    const totals = computeExpenseTotals([foodExpense, second])
    expect(totals.byCategory.food).toBe(55)
  })
})

// ─── fetchExpenses ────────────────────────────────────────────────────────────

describe('fetchExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_AUTH_USER }, error: null })
  })

  it('retorna gastos mapeados para un viaje', async () => {
    mockFrom.mockReturnValue(
      createQueryChain({ data: [MOCK_EXPENSE_ROW_FOOD, MOCK_EXPENSE_ROW_TRANSPORT], error: null })
    )
    const result = await fetchExpenses('trip-abc')
    expect(result).toHaveLength(2)
    expect(result[0]?.description).toBe('Cena en Roma')
    expect(result[1]?.description).toBe('Taxi al aeropuerto')
  })

  it('retorna array vacío si no hay gastos', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: [], error: null }))
    const result = await fetchExpenses('trip-sin-gastos')
    expect(result).toEqual([])
  })

  it('lanza error si Supabase falla', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: null, error: new Error('DB error') }))
    await expect(fetchExpenses('trip-abc')).rejects.toThrow('DB error')
  })

  it('lanza error si usuario no autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(fetchExpenses('trip-abc')).rejects.toThrow('Usuario no autenticado')
  })
})

// ─── createExpense ────────────────────────────────────────────────────────────

describe('createExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_AUTH_USER }, error: null })
  })

  it('crea un gasto y retorna el objeto mapeado', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: MOCK_EXPENSE_ROW_FOOD, error: null }))
    const result = await createExpense({
      tripId: 'trip-abc',
      description: 'Cena en Roma',
      amount: 40,
      currency: 'EUR',
      category: 'food',
    })
    expect(result.description).toBe('Cena en Roma')
    expect(result.amount).toBe(40)
    expect(result.category).toBe('food')
  })

  it('lanza error si Supabase falla al insertar', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: null, error: new Error('Insert failed') }))
    await expect(
      createExpense({ tripId: 'trip-abc', description: 'Test', amount: 10, currency: 'USD' })
    ).rejects.toThrow('Insert failed')
  })
})

// ─── archiveExpense ───────────────────────────────────────────────────────────

describe('archiveExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_AUTH_USER }, error: null })
  })

  it('archiva el gasto correctamente (soft delete)', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: null, error: null }))
    await expect(archiveExpense('exp-001')).resolves.toBeUndefined()
  })

  it('lanza error si el update falla', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: null, error: new Error('Update failed') }))
    await expect(archiveExpense('exp-001')).rejects.toThrow('Update failed')
  })
})

// ─── parseExpenseText ─────────────────────────────────────────────────────────

describe('parseExpenseText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const buildResult = (override: Partial<ParseExpenseResult> = {}): ParseExpenseResult => ({
    type: 'expense',
    confidence: 0.95,
    raw_text: 'gasté 40 euros en cena en Roma ayer',
    cached: false,
    fields: {
      amount: 40,
      currency: 'EUR',
      category: 'food',
      title: 'Cena en Roma',
      date: '2026-05-09',
    },
    ...override,
  })

  it('texto simple — extrae monto, moneda y categoría', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: buildResult(), error: null })
    const result = await parseExpenseText({ text: 'gasté 40 euros en cena en Roma ayer' })
    expect(result.type).toBe('expense')
    expect(result.fields.amount).toBe(40)
    expect(result.fields.currency).toBe('EUR')
    expect(result.fields.category).toBe('food')
    expect(result.fields.title).toBe('Cena en Roma')
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('texto complejo — ayer pagué 25 euros en almuerzo con amigos', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: buildResult({
        raw_text: 'ayer pagué 25 euros en almuerzo con amigos',
        confidence: 0.88,
        fields: { amount: 25, currency: 'EUR', category: 'food', title: 'Almuerzo con amigos', date: '2026-05-09' },
      }),
      error: null,
    })
    const result = await parseExpenseText({ text: 'ayer pagué 25 euros en almuerzo con amigos' })
    expect(result.fields.amount).toBe(25)
    expect(result.fields.category).toBe('food')
  })

  it('texto ambiguo — confidence baja, campos nulos', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: buildResult({
        raw_text: 'gasté algo ayer',
        confidence: 0.25,
        fields: { amount: null, currency: null, category: 'other', title: null, date: '2026-05-09' },
      }),
      error: null,
    })
    const result = await parseExpenseText({ text: 'gasté algo ayer' })
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.fields.amount).toBeNull()
    expect(result.fields.currency).toBeNull()
  })

  it('lanza error si la Edge Function falla', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: new Error('Edge Function error') })
    await expect(parseExpenseText({ text: 'gasté 10 dólares' })).rejects.toThrow()
  })

  it('texto con dólares — mapea currency a USD', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: buildResult({
        raw_text: 'gasté 10 dólares',
        confidence: 0.9,
        fields: { amount: 10, currency: 'USD', category: 'other', title: null, date: '2026-05-10' },
      }),
      error: null,
    })
    const result = await parseExpenseText({ text: 'gasté 10 dólares' })
    expect(result.fields.amount).toBe(10)
    expect(result.fields.currency).toBe('USD')
  })
})

// ─── convertCurrency ──────────────────────────────────────────────────────────

describe('convertCurrency', () => {
  const rates = { USD: 1, EUR: 0.92, GBP: 0.79, MXN: 17.2 }

  it('retorna el mismo monto si from === to', () => {
    expect(convertCurrency(100, 'USD', 'USD', rates)).toBe(100)
    expect(convertCurrency(50, 'EUR', 'EUR', rates)).toBe(50)
  })

  it('convierte USD → EUR correctamente', () => {
    expect(convertCurrency(100, 'USD', 'EUR', rates)).toBeCloseTo(92, 1)
  })

  it('convierte EUR → USD correctamente', () => {
    expect(convertCurrency(92, 'EUR', 'USD', rates)).toBeCloseTo(100, 1)
  })

  it('convierte entre dos monedas no-USD (EUR → GBP)', () => {
    const result = convertCurrency(100, 'EUR', 'GBP', rates)
    expect(result).toBeGreaterThan(0)
  })

  it('retorna el monto original si la moneda no está en las tasas', () => {
    expect(convertCurrency(100, 'XYZ', 'USD', rates)).toBe(100)
  })
})
