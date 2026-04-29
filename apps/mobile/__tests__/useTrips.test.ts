import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const {
  mockGetUser,
  mockFrom,
  mockSelect,
  mockEq,
  mockIs,
  mockOrder,
  mockSingle,
  mockInsert,
  mockUpdate,
} = vi.hoisted(() => {
  // Builder fluido que puede resolver o continuar encadenando
  const mockSingle = vi.fn()
  const mockOrder = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockIs = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()
  const mockGetUser = vi.fn()

  return {
    mockGetUser,
    mockFrom,
    mockSelect,
    mockEq,
    mockIs,
    mockOrder,
    mockSingle,
    mockInsert,
    mockUpdate,
  }
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

vi.mock('@/lib/notifications', () => ({
  cancelAllTripNotifications: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/offline/reader', () => ({
  saveTripsOffline: vi.fn().mockResolvedValue(undefined),
  getTripsOffline: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/offline/sync', () => ({
  addPendingOperation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: { getState: vi.fn().mockReturnValue({ showToast: vi.fn() }) },
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

// Importar las funciones puras DESPUÉS de los mocks
import { fetchUserTrips, createTrip, archiveTrip } from '../hooks/useTrips'
import { getTripsOffline } from '../lib/offline/reader'
import { addPendingOperation } from '../lib/offline/sync'
import { cancelAllTripNotifications } from '../lib/notifications'
import type { CreateTripInput } from '@travelapp/types'

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-test-123' }

// Registro de BD simulado (camelCase → snake_case como lo devuelve Supabase)
const MOCK_TRIP_ROW = {
  id: 'trip-abc',
  user_id: 'user-test-123',
  title: 'Viaje a Tokio',
  description: null,
  cover_image_url: null,
  status: 'planning',
  destinations: [{ city: 'Tokio', country: 'Japón' }],
  start_date: '2026-06-01',
  end_date: '2026-06-15',
  travelers_count: 2,
  pace: 'moderate',
  budget: 'mid',
  base_currency: 'EUR',
  deleted_at: null,
  created_at: '2026-04-22T00:00:00.000Z',
  updated_at: '2026-04-22T00:00:00.000Z',
}

// Configura el encadenamiento fluido del query builder de Supabase
const setupQueryChain = (resolvedValue: { data: unknown; error: unknown }) => {
  mockOrder.mockResolvedValue(resolvedValue)
  mockSingle.mockResolvedValue(resolvedValue)
  mockIs.mockReturnValue({ order: mockOrder, single: mockSingle })
  mockEq.mockReturnValue({ is: mockIs, eq: mockEq, single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) })
  mockUpdate.mockReturnValue({ eq: () => ({ eq: () => Promise.resolve(resolvedValue) }) })
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })
}

// ─── fetchUserTrips ───────────────────────────────────────────────────────────

describe('fetchUserTrips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('llama a supabase.from("trips") con el ID del usuario autenticado', async () => {
    setupQueryChain({ data: [MOCK_TRIP_ROW], error: null })

    await fetchUserTrips()

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockEq).toHaveBeenCalledWith('user_id', MOCK_USER.id)
  })

  it('filtra registros con deleted_at !== null mediante is("deleted_at", null)', async () => {
    setupQueryChain({ data: [MOCK_TRIP_ROW], error: null })

    await fetchUserTrips()

    expect(mockIs).toHaveBeenCalledWith('deleted_at', null)
  })

  it('retorna los viajes mapeados a camelCase desde snake_case de BD', async () => {
    setupQueryChain({ data: [MOCK_TRIP_ROW], error: null })

    const trips = await fetchUserTrips()

    expect(trips).toHaveLength(1)
    expect(trips[0]).toMatchObject({
      id: 'trip-abc',
      userId: 'user-test-123',
      title: 'Viaje a Tokio',
      status: 'planning',
      travelersCount: 2,
      baseCurrency: 'EUR',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    })
  })

  it('retorna array vacío si el usuario no tiene viajes', async () => {
    setupQueryChain({ data: [], error: null })

    const trips = await fetchUserTrips()

    expect(trips).toEqual([])
  })

  it('lanza error si Supabase falla y no silencia el error', async () => {
    setupQueryChain({ data: null, error: new Error('Error de conexión') })
    // Supabase devuelve el error dentro del objeto, no como rechazo de promesa
    mockOrder.mockResolvedValue({ data: null, error: new Error('Error de conexión') })

    await expect(fetchUserTrips()).rejects.toThrow('Error de conexión')
  })

  it('lanza error si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(fetchUserTrips()).rejects.toThrow('Usuario no autenticado')
  })
})

// ─── createTrip ──────────────────────────────────────────────────────────────

describe('createTrip', () => {
  const VALID_INPUT: CreateTripInput = {
    title: 'París romántico',
    destinations: [{ city: 'París', country: 'Francia' }],
    startDate: '2026-07-10',
    endDate: '2026-07-20',
    travelersCount: 2,
    budget: 'premium',
    pace: 'moderate',
    baseCurrency: 'EUR',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
    setupQueryChain({ data: MOCK_TRIP_ROW, error: null })
  })

  it('llama a supabase.from("trips").insert() con los campos correctos en snake_case', async () => {
    await createTrip(VALID_INPUT)

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: MOCK_USER.id,
        title: 'París romántico',
        destinations: [{ city: 'París', country: 'Francia' }],
        start_date: '2026-07-10',
        end_date: '2026-07-20',
        travelers_count: 2,
        budget: 'premium',
        pace: 'moderate',
        base_currency: 'EUR',
        status: 'planning',
      })
    )
  })

  it('usa defaults correctos cuando no se proveen campos opcionales', async () => {
    const minimalInput: CreateTripInput = {
      title: 'Escapada rápida',
      destinations: [{ city: 'Lisboa', country: 'Portugal' }],
    }

    await createTrip(minimalInput)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        travelers_count: 1,        // default
        base_currency: 'USD',      // default
        status: 'planning',
      })
    )
  })

  it('retorna el viaje creado mapeado a camelCase', async () => {
    const trip = await createTrip(VALID_INPUT)

    expect(trip).toMatchObject({
      id: 'trip-abc',
      userId: 'user-test-123',
      title: 'Viaje a Tokio',
    })
  })

  it('lanza error si el insert de Supabase falla', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('Insert fallido') })

    await expect(createTrip(VALID_INPUT)).rejects.toThrow('Insert fallido')
  })
})

// ─── archiveTrip ──────────────────────────────────────────────────────────────

describe('archiveTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
    // Soft delete vía update — resolución exitosa por defecto
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  it('ejecuta soft delete: llama update con deleted_at en lugar de DELETE físico', async () => {
    await archiveTrip('trip-abc')

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
    // Nunca debe haber llamada a .delete()
    expect(mockFrom().delete).toBeUndefined()
  })

  it('cancela las notificaciones del viaje al archivar', async () => {
    await archiveTrip('trip-abc')

    expect(cancelAllTripNotifications).toHaveBeenCalledWith('trip-abc')
  })

  it('encola operación offline si Supabase falla', async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('Sin conexión') }),
      }),
    })

    await archiveTrip('trip-offline')

    expect(addPendingOperation).toHaveBeenCalledWith(
      'trips',
      'delete',
      'trip-offline',
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
  })

  it('cancela notificaciones incluso cuando Supabase falla (no bloquea)', async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('Sin conexión') }),
      }),
    })

    await archiveTrip('trip-abc')

    // La cancelación de notificaciones es independiente del resultado de red
    expect(cancelAllTripNotifications).toHaveBeenCalledWith('trip-abc')
  })
})

// ─── fetchUserTrips — fallback offline ───────────────────────────────────────

describe('fetchUserTrips — fallback offline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('retorna datos offline cuando Supabase falla y hay caché disponible', async () => {
    // Supabase falla en la query
    mockOrder.mockResolvedValue({ data: null, error: new Error('Error de red') })
    mockIs.mockReturnValue({ order: mockOrder })
    mockEq.mockReturnValue({ is: mockIs })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    // Hay datos en el caché offline
    const offlineTrip = { id: 'trip-offline', title: 'Viaje en caché' } as never
    vi.mocked(getTripsOffline).mockResolvedValue([offlineTrip])

    const trips = await fetchUserTrips()

    expect(getTripsOffline).toHaveBeenCalledTimes(1)
    expect(trips).toHaveLength(1)
    expect(trips[0]).toMatchObject({ id: 'trip-offline' })
  })

  it('lanza el error de Supabase si no hay datos offline disponibles', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('Error de red') })
    mockIs.mockReturnValue({ order: mockOrder })
    mockEq.mockReturnValue({ is: mockIs })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    // Sin datos en caché offline
    vi.mocked(getTripsOffline).mockResolvedValue([])

    await expect(fetchUserTrips()).rejects.toThrow('Error de red')
  })

  it('guarda los viajes en caché offline después de una fetch exitosa', async () => {
    setupQueryChain({ data: [MOCK_TRIP_ROW], error: null })

    await fetchUserTrips()

    // saveTripsOffline se llama en background con los viajes obtenidos
    const { saveTripsOffline } = await import('../lib/offline/reader')
    // Damos tiempo a la operación en background
    await new Promise((r) => setTimeout(r, 10))
    expect(saveTripsOffline).toHaveBeenCalledTimes(1)
  })
})
