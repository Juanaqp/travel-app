import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const { mockFrom, mockSelect, mockEq, mockIs, mockOrder, mockLimit, mockMaybeSingle } =
  vi.hoisted(() => {
    const mockMaybeSingle = vi.fn()
    const mockLimit = vi.fn()
    const mockOrder = vi.fn()
    const mockIs = vi.fn()
    const mockEq = vi.fn()
    const mockSelect = vi.fn()
    const mockFrom = vi.fn()

    return { mockFrom, mockSelect, mockEq, mockIs, mockOrder, mockLimit, mockMaybeSingle }
  })

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Importar después de los mocks
import { fetchLatestItinerary } from '../hooks/useItinerary'
import type { ItineraryGraph } from '@travelapp/types'

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const MOCK_GRAPH: ItineraryGraph = {
  id: 'itin-001',
  tripId: 'trip-xyz',
  status: 'draft',
  generatedBy: 'gemini-2.0-flash',
  userPrompt: 'París romántico',
  days: [
    { id: 'day-1', date: '2026-07-10', dayNumber: 1, nodeIds: ['node-1'] },
  ],
  nodes: {
    'node-1': {
      id: 'node-1',
      type: 'poi',
      dayId: 'day-1',
      order: 0,
      time: '10:00',
      durationMinutes: 90,
      endTime: '11:30',
      name: 'Torre Eiffel',
      description: '',
      emoji: '🗼',
      aiTip: '',
      location: {},
      cost: {},
      userStatus: 'approved',
      isAiGenerated: true,
      isUserModified: false,
      createdAt: '2026-07-10T00:00:00.000Z',
    },
  },
  edges: [],
  meta: { totalDays: 1, totalNodes: 1, version: '2.1.0' },
}

const MOCK_ROW = {
  id: 'itinerary-abc',
  trip_id: 'trip-xyz',
  graph: MOCK_GRAPH,
  generated_by: 'gemini-2.0-flash',
  user_prompt: 'París romántico',
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

// Configura el encadenamiento fluido de Supabase
const setupChain = (resolvedValue: { data: unknown; error: unknown }) => {
  mockMaybeSingle.mockResolvedValue(resolvedValue)
  mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockIs.mockReturnValue({ order: mockOrder })
  mockEq.mockReturnValue({ eq: mockEq, is: mockIs })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ─── fetchLatestItinerary ─────────────────────────────────────────────────────

describe('fetchLatestItinerary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('consulta la tabla itineraries con los filtros correctos', async () => {
    setupChain({ data: MOCK_ROW, error: null })

    await fetchLatestItinerary('trip-xyz')

    expect(mockFrom).toHaveBeenCalledWith('itineraries')
    expect(mockEq).toHaveBeenCalledWith('trip_id', 'trip-xyz')
    expect(mockEq).toHaveBeenCalledWith('status', 'approved')
    expect(mockIs).toHaveBeenCalledWith('deleted_at', null)
  })

  it('mapea la fila de BD al tipo SavedItinerary en camelCase', async () => {
    setupChain({ data: MOCK_ROW, error: null })

    const result = await fetchLatestItinerary('trip-xyz')

    expect(result).toMatchObject({
      id: 'itinerary-abc',
      tripId: 'trip-xyz',
      generatedBy: 'gemini-2.0-flash',
      userPrompt: 'París romántico',
      createdAt: '2026-07-10T00:00:00.000Z',
    })
  })

  it('expone el graph completo tal como viene de BD', async () => {
    setupChain({ data: MOCK_ROW, error: null })

    const result = await fetchLatestItinerary('trip-xyz')

    expect(result?.graph).toEqual(MOCK_GRAPH)
  })

  it('retorna null cuando no hay itinerario aprobado para el viaje', async () => {
    setupChain({ data: null, error: null })

    const result = await fetchLatestItinerary('trip-sin-itinerario')

    expect(result).toBeNull()
  })

  it('lanza error si Supabase falla', async () => {
    setupChain({ data: null, error: new Error('DB connection error') })

    await expect(fetchLatestItinerary('trip-xyz')).rejects.toThrow('DB connection error')
  })

  it('ordena por created_at descendente y toma el más reciente', async () => {
    setupChain({ data: MOCK_ROW, error: null })

    await fetchLatestItinerary('trip-xyz')

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(1)
  })
})
