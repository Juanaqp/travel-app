import { describe, it, expect, vi, beforeEach } from 'vitest'
import { editNode } from '../hooks/useEditNode'
import type { EditNodeParams } from '../hooks/useEditNode'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInvoke = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const baseParams: EditNodeParams = {
  itineraryId: '11111111-1111-1111-1111-111111111111',
  nodeId: 'node-abc',
  instruction: 'Cambia la duración a 90 minutos',
}

const updatedNode = {
  id: 'node-abc',
  type: 'poi',
  dayId: 'day-1',
  order: 0,
  time: '09:00',
  durationMinutes: 90,
  endTime: '10:30',
  name: 'Museo del Prado',
  description: 'Visita al museo',
  emoji: '🏛️',
  aiTip: '',
  location: {},
  cost: {},
  userStatus: 'modified',
  isAiGenerated: true,
  isUserModified: true,
  createdAt: '2026-07-10T00:00:00Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('editNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invoca la Edge Function edit-node con los parámetros correctos', async () => {
    mockInvoke.mockResolvedValue({ data: updatedNode, error: null })

    await editNode(baseParams)

    expect(mockInvoke).toHaveBeenCalledWith('edit-node', {
      body: {
        itineraryId: baseParams.itineraryId,
        nodeId: baseParams.nodeId,
        instruction: baseParams.instruction,
      },
    })
  })

  it('devuelve el nodo actualizado en caso de éxito', async () => {
    mockInvoke.mockResolvedValue({ data: updatedNode, error: null })

    const result = await editNode(baseParams)

    expect(result).toEqual(updatedNode)
    expect(result.id).toBe('node-abc')
    expect(result.userStatus).toBe('modified')
    expect(result.isUserModified).toBe(true)
  })

  it('lanza error si Supabase devuelve error de red', async () => {
    const networkError = new Error('Network request failed')
    mockInvoke.mockResolvedValue({ data: null, error: networkError })

    await expect(editNode(baseParams)).rejects.toThrow('Network request failed')
  })

  it('lanza error con el mensaje del servidor si data.error está presente', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Nodo no encontrado en el itinerario' },
      error: null,
    })

    await expect(editNode(baseParams)).rejects.toThrow('Nodo no encontrado en el itinerario')
  })

  it('lanza error si la IA devuelve nodo inválido (data.error)', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'La IA devolvió un nodo inválido' },
      error: null,
    })

    await expect(editNode(baseParams)).rejects.toThrow('La IA devolvió un nodo inválido')
  })

  it('lanza error si el timeout se agota (error de Supabase)', async () => {
    const timeoutError = new Error('Timeout: la IA tardó demasiado en responder')
    mockInvoke.mockResolvedValue({ data: null, error: timeoutError })

    await expect(editNode(baseParams)).rejects.toThrow('Timeout')
  })

  it('maneja error si data es null y error también es null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null })

    // Debe devolver null como ItineraryNode (tipo cast), sin lanzar
    const result = await editNode(baseParams)
    expect(result).toBeNull()
  })
})
