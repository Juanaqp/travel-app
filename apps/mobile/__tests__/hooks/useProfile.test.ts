// Tests de fetchProfile y fetchProfileStats — funciones puras de useProfile.ts
// Cubre: mapeo snake_case→camelCase, defaults, autenticación, conteo de países únicos, suma de gastos

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const { mockGetUser, mockFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  return { mockGetUser, mockFrom }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// useProfile importa hooks de React Query — se prueban solo las funciones puras
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}))

import { fetchProfile, fetchProfileStats } from '../../hooks/useProfile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Crea un builder fluido thenable para simular el query builder de Supabase.
// Cada método devuelve el mismo chain, y .then() lo hace awaitable directamente.
const createChain = (value: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {
    then: (onfulfilled: (v: unknown) => unknown) =>
      Promise.resolve(value).then(onfulfilled),
  }
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(value)
  chain.maybeSingle = vi.fn().mockResolvedValue(value)
  return chain
}

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-profile-test' }

// Fila completa de la tabla users en snake_case (como devuelve Supabase)
const MOCK_PROFILE_ROW = {
  id: 'user-profile-test',
  email: 'juan@example.com',
  full_name: 'Juan García',
  avatar_url: 'https://example.com/avatar.jpg',
  plan: 'pro',
  ai_messages_used_this_month: 5,
  ai_messages_limit: 50,
  ai_messages_reset_at: '2026-05-01T00:00:00.000Z',
  preferred_currency: 'EUR',
  preferred_language: 'es',
  timezone: 'Europe/Madrid',
  travel_interests: ['cultura', 'gastronomía'],
  preferred_pace: 'moderate',
  preferred_budget: 'mid',
  onboarding_completed: true,
  created_at: '2026-04-22T00:00:00.000Z',
  updated_at: '2026-04-29T00:00:00.000Z',
}

// ─── fetchProfile ─────────────────────────────────────────────────────────────

describe('fetchProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('consulta supabase.from("users") con el ID del usuario autenticado', async () => {
    const chain = createChain({ data: MOCK_PROFILE_ROW, error: null })
    mockFrom.mockReturnValue(chain)

    await fetchProfile()

    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(chain.eq).toHaveBeenCalledWith('id', MOCK_USER.id)
  })

  it('mapea todos los campos snake_case de BD a camelCase del dominio correctamente', async () => {
    const chain = createChain({ data: MOCK_PROFILE_ROW, error: null })
    mockFrom.mockReturnValue(chain)

    const profile = await fetchProfile()

    expect(profile).toMatchObject({
      id: 'user-profile-test',
      email: 'juan@example.com',
      fullName: 'Juan García',
      avatarUrl: 'https://example.com/avatar.jpg',
      plan: 'pro',
      aiMessagesUsedThisMonth: 5,
      aiMessagesLimit: 50,
      aiMessagesResetAt: '2026-05-01T00:00:00.000Z',
      preferredCurrency: 'EUR',
      preferredLanguage: 'es',
      timezone: 'Europe/Madrid',
      travelInterests: ['cultura', 'gastronomía'],
      preferredPace: 'moderate',
      preferredBudget: 'mid',
      onboardingCompleted: true,
    })
  })

  it('aplica defaults correctos para campos opcionales con valor null en BD', async () => {
    const rowWithNulls = {
      ...MOCK_PROFILE_ROW,
      plan: null,                         // → 'free'
      ai_messages_used_this_month: null,  // → 0
      ai_messages_limit: null,            // → 20
      preferred_currency: null,           // → 'USD'
      preferred_language: null,           // → 'es'
      timezone: null,                     // → 'UTC'
      travel_interests: null,             // → []
      onboarding_completed: null,         // → false
    }
    const chain = createChain({ data: rowWithNulls, error: null })
    mockFrom.mockReturnValue(chain)

    const profile = await fetchProfile()

    expect(profile.plan).toBe('free')
    expect(profile.aiMessagesUsedThisMonth).toBe(0)
    expect(profile.aiMessagesLimit).toBe(20)
    expect(profile.preferredCurrency).toBe('USD')
    expect(profile.preferredLanguage).toBe('es')
    expect(profile.timezone).toBe('UTC')
    expect(profile.travelInterests).toEqual([])
    expect(profile.onboardingCompleted).toBe(false)
  })

  it('lanza "Usuario no autenticado" si getUser devuelve user=null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(fetchProfile()).rejects.toThrow('Usuario no autenticado')
  })

  it('lanza "Usuario no autenticado" si getUser devuelve error de auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('JWT expired') })

    await expect(fetchProfile()).rejects.toThrow('Usuario no autenticado')
  })

  it('lanza el error de Supabase si la query a la tabla users falla', async () => {
    const chain = createChain({ data: null, error: new Error('DB connection failed') })
    mockFrom.mockReturnValue(chain)

    await expect(fetchProfile()).rejects.toThrow('DB connection failed')
  })
})

// ─── fetchProfileStats ────────────────────────────────────────────────────────

describe('fetchProfileStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('retorna ceros si el usuario no tiene viajes, itinerarios ni gastos', async () => {
    mockFrom.mockImplementation(() => createChain({ data: [], error: null }))

    const stats = await fetchProfileStats()

    expect(stats).toEqual({
      totalTrips: 0,
      countriesVisited: 0,
      itinerariesGenerated: 0,
      totalExpensesUSD: 0,
    })
  })

  it('cuenta correctamente el número total de viajes', async () => {
    const trips = [
      { destinations: [{ city: 'Madrid', country: 'España' }] },
      { destinations: [{ city: 'Tokyo', country: 'Japón' }] },
      { destinations: [{ city: 'París', country: 'Francia' }] },
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return createChain({ data: trips, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.totalTrips).toBe(3)
  })

  it('deduplica países — visitar el mismo país en 2 viajes cuenta como 1', async () => {
    const trips = [
      { destinations: [{ city: 'Madrid', country: 'España' }] },
      { destinations: [{ city: 'Barcelona', country: 'España' }] },  // mismo país
      { destinations: [{ city: 'París', country: 'Francia' }] },
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return createChain({ data: trips, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.countriesVisited).toBe(2)  // España + Francia
  })

  it('un viaje con múltiples destinos en países diferentes suma cada país', async () => {
    const trips = [
      { destinations: [{ city: 'Lisboa', country: 'Portugal' }, { city: 'Madrid', country: 'España' }] },
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return createChain({ data: trips, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.countriesVisited).toBe(2)
  })

  it('ignora viajes con destinations null o sin campo country', async () => {
    const trips = [
      { destinations: null },                                        // null → ignorado
      { destinations: [{ city: 'Sin país' }] },                    // sin country → ignorado
      { destinations: [{ city: 'Roma', country: 'Italia' }] },
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return createChain({ data: trips, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.countriesVisited).toBe(1)  // solo Italia
  })

  it('cuenta correctamente los itinerarios generados', async () => {
    const itineraries = [{ id: 'it-1' }, { id: 'it-2' }, { id: 'it-3' }]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'itineraries') return createChain({ data: itineraries, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.itinerariesGenerated).toBe(3)
  })

  it('suma correctamente los gastos como número flotante', async () => {
    const expenses = [
      { amount: 100, currency: 'USD' },
      { amount: 50.5, currency: 'USD' },
      { amount: 200, currency: 'USD' },
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'expenses') return createChain({ data: expenses, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.totalExpensesUSD).toBeCloseTo(350.5, 1)
  })

  it('convierte amounts en string a número antes de sumar', async () => {
    const expenses = [
      { amount: '42.50', currency: 'USD' },
      { amount: 57.5, currency: 'USD' },
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'expenses') return createChain({ data: expenses, error: null })
      return createChain({ data: [], error: null })
    })

    const stats = await fetchProfileStats()

    expect(stats.totalExpensesUSD).toBeCloseTo(100, 1)
  })

  it('retorna ceros sin llamar a from() si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const stats = await fetchProfileStats()

    expect(stats).toEqual({
      totalTrips: 0,
      countriesVisited: 0,
      itinerariesGenerated: 0,
      totalExpensesUSD: 0,
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
