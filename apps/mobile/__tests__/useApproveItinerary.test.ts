import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const {
  mockGetUser,
  mockFrom,
  mockSingle,
  mockSelectId,
  mockInsertItinerary,
  mockInsertFeedback,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelectId = vi.fn()
  const mockInsertItinerary = vi.fn()
  const mockInsertFeedback = vi.fn()
  const mockFrom = vi.fn()
  const mockGetUser = vi.fn()

  return {
    mockGetUser,
    mockFrom,
    mockSingle,
    mockSelectId,
    mockInsertItinerary,
    mockInsertFeedback,
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

// Importar la función pura DESPUÉS de los mocks
import { approveItinerary } from '../hooks/useApproveItinerary'
import type { ItineraryGraph } from '@travelapp/types'

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-test-123' }
const MOCK_ITINERARY_ID = 'itinerary-abc-456'

// Nodo POI aprobado
const MOCK_NODE_APPROVED = {
  id: 'node-1',
  type: 'poi' as const,
  dayId: 'day-1',
  order: 0,
  time: '10:00',
  durationMinutes: 90,
  endTime: '11:30',
  name: 'Torre Eiffel',
  description: 'Icónico símbolo de París',
  emoji: '🗼',
  aiTip: 'Visita temprano para evitar colas',
  location: { address: 'Champ de Mars, París', lat: 48.8584, lng: 2.2945 },
  cost: { amount: 0, currency: 'EUR', isIncluded: false },
  userStatus: 'approved' as const,
  isAiGenerated: true,
  isUserModified: false,
  createdAt: '2026-04-22T00:00:00.000Z',
}

// Nodo restaurante rechazado
const MOCK_NODE_REJECTED = {
  id: 'node-2',
  type: 'restaurant' as const,
  dayId: 'day-1',
  order: 1,
  time: '13:00',
  durationMinutes: 60,
  endTime: '14:00',
  name: 'Café de Flore',
  description: 'Histórico café parisino',
  emoji: '☕',
  aiTip: 'Prueba el croque-monsieur',
  location: { address: '172 Blvd Saint-Germain, París' },
  cost: { amount: 25, currency: 'EUR' },
  userStatus: 'rejected' as const,
  isAiGenerated: true,
  isUserModified: false,
  createdAt: '2026-04-22T00:00:00.000Z',
}

// Nodo actividad modificado por el usuario
const MOCK_NODE_MODIFIED = {
  id: 'node-3',
  type: 'activity' as const,
  dayId: 'day-1',
  order: 2,
  time: '15:00',
  durationMinutes: 120,
  endTime: '17:00',
  name: 'Tour por el Louvre (editado)',
  description: 'Visita guiada al museo',
  emoji: '🖼️',
  aiTip: 'Reserva con antelación',
  location: { address: 'Rue de Rivoli, París' },
  cost: { amount: 17, currency: 'EUR' },
  userStatus: 'modified' as const,
  isAiGenerated: true,
  isUserModified: true,
  createdAt: '2026-04-22T00:00:00.000Z',
}

const MOCK_DRAFT_GRAPH: ItineraryGraph = {
  id: 'draft-001',
  tripId: 'trip-xyz',
  status: 'reviewing',
  generatedBy: 'gpt-4o-mini',
  userPrompt: 'París romántico — museos y gastronomía',
  days: [
    {
      id: 'day-1',
      date: '2026-07-10',
      dayNumber: 1,
      title: 'Día 1 — Llegada a París',
      nodeIds: ['node-1', 'node-2', 'node-3'],
    },
  ],
  nodes: {
    'node-1': MOCK_NODE_APPROVED,
    'node-2': MOCK_NODE_REJECTED,
    'node-3': MOCK_NODE_MODIFIED,
  },
  edges: [],
  meta: {
    totalDays: 1,
    totalNodes: 3,
    estimatedTotalCost: 42,
    currency: 'EUR',
    version: '2.1.0',
  },
}

// ─── Configuración del encadenamiento fluido de Supabase ─────────────────────

const setupMocks = ({
  itineraryError = null,
  feedbackError = null,
}: {
  itineraryError?: Error | null
  feedbackError?: Error | null
} = {}) => {
  mockSingle.mockResolvedValue({
    data: itineraryError ? null : { id: MOCK_ITINERARY_ID },
    error: itineraryError,
  })
  mockSelectId.mockReturnValue({ single: mockSingle })
  mockInsertItinerary.mockReturnValue({ select: mockSelectId })
  mockInsertFeedback.mockResolvedValue({ error: feedbackError })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'itineraries') return { insert: mockInsertItinerary }
    if (table === 'ai_feedback') return { insert: mockInsertFeedback }
    return {}
  })
}

// ─── approveItinerary ─────────────────────────────────────────────────────────

describe('approveItinerary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
    setupMocks()
  })

  it('inserta el itinerario en BD con status "approved" y los campos correctos', async () => {
    await approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })

    expect(mockFrom).toHaveBeenCalledWith('itineraries')
    expect(mockInsertItinerary).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: 'trip-xyz',
        user_id: MOCK_USER.id,
        status: 'approved',
        graph: MOCK_DRAFT_GRAPH,
        generated_by: 'gpt-4o-mini',
        user_prompt: 'París romántico — museos y gastronomía',
      })
    )
  })

  it('retorna el ID del itinerario creado', async () => {
    const result = await approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })

    expect(result).toEqual({ itineraryId: MOCK_ITINERARY_ID })
  })

  it('registra el nodo rechazado en ai_feedback con action "rejected"', async () => {
    await approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })

    expect(mockFrom).toHaveBeenCalledWith('ai_feedback')
    expect(mockInsertFeedback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: 'node-2',
          action: 'rejected',
          user_id: MOCK_USER.id,
          trip_id: 'trip-xyz',
          itinerary_id: MOCK_ITINERARY_ID,
        }),
      ])
    )
  })

  it('registra el nodo modificado en ai_feedback con action "modified"', async () => {
    await approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })

    expect(mockInsertFeedback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: 'node-3',
          action: 'modified',
        }),
      ])
    )
  })

  it('registra el nodo aprobado en ai_feedback con action "approved"', async () => {
    await approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })

    expect(mockInsertFeedback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: 'node-1',
          action: 'approved',
        }),
      ])
    )
  })

  it('guarda modified_content solo en nodos con isUserModified === true', async () => {
    await approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })

    const feedbackCall = mockInsertFeedback.mock.calls[0][0] as Array<{
      node_id: string
      modified_content: unknown
    }>

    const approvedRecord = feedbackCall.find((r) => r.node_id === 'node-1')
    const modifiedRecord = feedbackCall.find((r) => r.node_id === 'node-3')

    // Nodo no modificado por el usuario → modified_content vacío
    expect(approvedRecord?.modified_content).toEqual({})
    // Nodo modificado por el usuario → modified_content contiene el nodo
    expect(modifiedRecord?.modified_content).toMatchObject({ id: 'node-3' })
  })

  it('no lanza error si el insert de ai_feedback falla (feedback es no bloqueante)', async () => {
    setupMocks({ feedbackError: new Error('Feedback DB error') })

    // El itinerario ya fue guardado — el feedback no debe bloquear
    await expect(
      approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })
    ).resolves.toEqual({ itineraryId: MOCK_ITINERARY_ID })
  })

  it('lanza error si el insert del itinerario falla', async () => {
    setupMocks({ itineraryError: new Error('Insert itinerary failed') })

    await expect(
      approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })
    ).rejects.toThrow('Insert itinerary failed')
  })

  it('lanza error si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(
      approveItinerary({ tripId: 'trip-xyz', draftGraph: MOCK_DRAFT_GRAPH })
    ).rejects.toThrow('Usuario no autenticado')
  })
})
