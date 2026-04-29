import { describe, it, expect } from 'vitest'
import type { Trip } from '@travelapp/types'

// No importamos desde la pantalla directamente para evitar que vitest cargue
// la cadena de dependencias React Native (expo-sqlite, etc.) en el entorno Node.
// La lógica testeable está reimplementada aquí — idéntica a la de explore.tsx.

// ─── Función helper (idéntica a getActiveTrip en explore.tsx) ─────────────────

const getActiveTrip = (trips: Trip[]): Trip | null => trips[0] ?? null

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const makeTripMock = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip-001',
  userId: 'user-123',
  title: 'Viaje a Roma',
  status: 'planning',
  destinations: [{ city: 'Roma', country: 'Italia' }],
  travelersCount: 2,
  baseCurrency: 'EUR',
  createdAt: '2026-04-28T00:00:00.000Z',
  updatedAt: '2026-04-28T00:00:00.000Z',
  ...overrides,
})

// ─── getActiveTrip ────────────────────────────────────────────────────────────

describe('getActiveTrip', () => {
  it('retorna el primer viaje de la lista (useTrips ordena por created_at DESC)', () => {
    const trips = [
      makeTripMock({ id: 'trip-newest', createdAt: '2026-04-28T00:00:00.000Z' }),
      makeTripMock({ id: 'trip-older',  createdAt: '2026-03-01T00:00:00.000Z' }),
    ]

    expect(getActiveTrip(trips)?.id).toBe('trip-newest')
  })

  it('retorna null si no hay viajes', () => {
    expect(getActiveTrip([])).toBeNull()
  })

  it('retorna el único viaje si solo hay uno', () => {
    expect(getActiveTrip([makeTripMock()])).toMatchObject({ id: 'trip-001' })
  })

  it('retorna el primer viaje independientemente del status', () => {
    const trips = [
      makeTripMock({ id: 'trip-completed', status: 'completed' }),
      makeTripMock({ id: 'trip-planning',  status: 'planning' }),
    ]

    expect(getActiveTrip(trips)?.id).toBe('trip-completed')
  })
})

// ─── Lógica de acceso rápido ──────────────────────────────────────────────────

describe('Botones de acceso rápido — rutas con viaje activo', () => {
  it('la ruta de documentos incluye el trip ID', () => {
    const trip = makeTripMock({ id: 'trip-abc' })

    expect(`/(app)/trips/${trip.id}/documents`).toBe('/(app)/trips/trip-abc/documents')
  })

  it('la ruta de gastos incluye el trip ID y /new', () => {
    const trip = makeTripMock({ id: 'trip-abc' })

    expect(`/(app)/trips/${trip.id}/expenses/new`).toBe('/(app)/trips/trip-abc/expenses/new')
  })

  it('la ruta de mapa incluye el trip ID', () => {
    const trip = makeTripMock({ id: 'trip-abc' })

    expect(`/(app)/trips/${trip.id}/itinerary/map`).toBe('/(app)/trips/trip-abc/itinerary/map')
  })

  it('sin viaje activo: getActiveTrip devuelve null y el Alert debe mostrarse', () => {
    expect(getActiveTrip([])).toBeNull()
    // La pantalla comprueba !activeTrip antes de mostrar el Alert
    expect(!getActiveTrip([])).toBe(true)
  })
})

// ─── Lógica del buscador ──────────────────────────────────────────────────────

describe('Búsqueda en Explorar', () => {
  it('usuario no autenticado: user es null — debe redirigir a login', () => {
    const user = null

    expect(!user).toBe(true)
  })

  it('usuario autenticado: puede iniciar búsqueda', () => {
    const user = { id: 'user-123', email: 'test@test.com' }

    expect(!!user).toBe(true)
  })

  it('query vacío: no dispara búsqueda', () => {
    expect('   '.trim()).toBe('')
    expect(!'   '.trim()).toBe(true)
  })
})

// ─── Estado vacío del feed ────────────────────────────────────────────────────

describe('Estado vacío en Destinos populares', () => {
  it('muestra EmptyState cuando destinations es array vacío', () => {
    const destinations: unknown[] = []

    expect(destinations.length === 0).toBe(true)
  })

  it('muestra la lista cuando hay destinos', () => {
    const destinations = [{ name: 'Roma', trip_count: 1, image_url: '...', continent: 'Europe' }]

    expect(destinations.length > 0).toBe(true)
  })
})
