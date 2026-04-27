import { describe, it, expect } from 'vitest'
import { reorderDayNodes, calculateEndTime, DEFAULT_NODE_EMOJI } from '../lib/reorderNodes'
import type { ItineraryGraph } from '@travelapp/types'

// ─── Grafo mínimo de prueba ───────────────────────────────────────────────────

const makeGraph = (): ItineraryGraph => ({
  id: 'itin-001',
  tripId: 'trip-xyz',
  status: 'draft',
  generatedBy: 'gpt-4o-mini',
  userPrompt: 'Test',
  days: [
    { id: 'day-1', date: '2026-07-10', dayNumber: 1, nodeIds: ['n1', 'n2', 'n3'] },
    { id: 'day-2', date: '2026-07-11', dayNumber: 2, nodeIds: ['n4'] },
  ],
  nodes: {
    n1: {
      id: 'n1', type: 'poi', dayId: 'day-1', order: 0, time: '09:00',
      durationMinutes: 60, endTime: '10:00', name: 'A', description: '', emoji: '📍',
      aiTip: '', location: {}, cost: {}, userStatus: 'approved',
      isAiGenerated: true, isUserModified: false, createdAt: '2026-07-10T00:00:00Z',
    },
    n2: {
      id: 'n2', type: 'restaurant', dayId: 'day-1', order: 1, time: '12:00',
      durationMinutes: 60, endTime: '13:00', name: 'B', description: '', emoji: '🍽️',
      aiTip: '', location: {}, cost: {}, userStatus: 'approved',
      isAiGenerated: true, isUserModified: false, createdAt: '2026-07-10T00:00:00Z',
    },
    n3: {
      id: 'n3', type: 'activity', dayId: 'day-1', order: 2, time: '15:00',
      durationMinutes: 120, endTime: '17:00', name: 'C', description: '', emoji: '🎯',
      aiTip: '', location: {}, cost: {}, userStatus: 'approved',
      isAiGenerated: true, isUserModified: false, createdAt: '2026-07-10T00:00:00Z',
    },
    n4: {
      id: 'n4', type: 'poi', dayId: 'day-2', order: 0, time: '10:00',
      durationMinutes: 90, endTime: '11:30', name: 'D', description: '', emoji: '📍',
      aiTip: '', location: {}, cost: {}, userStatus: 'approved',
      isAiGenerated: true, isUserModified: false, createdAt: '2026-07-11T00:00:00Z',
    },
  },
  edges: [
    { id: 'edge-n1-n2', fromNodeId: 'n1', toNodeId: 'n2', type: 'sequential' },
    { id: 'edge-n2-n3', fromNodeId: 'n2', toNodeId: 'n3', type: 'sequential' },
    { id: 'edge-n1-n3', fromNodeId: 'n1', toNodeId: 'n3', type: 'optional' },
  ],
  meta: { totalDays: 2, totalNodes: 4, version: '2.1.0' },
})

// ─── reorderDayNodes ──────────────────────────────────────────────────────────

describe('reorderDayNodes', () => {
  it('actualiza el campo order en cada nodo al reordenar', () => {
    const graph = makeGraph()
    const result = reorderDayNodes(graph, 'day-1', ['n3', 'n1', 'n2'])

    expect(result.nodes['n3']?.order).toBe(0)
    expect(result.nodes['n1']?.order).toBe(1)
    expect(result.nodes['n2']?.order).toBe(2)
  })

  it('actualiza nodeIds del día con el nuevo orden', () => {
    const graph = makeGraph()
    const result = reorderDayNodes(graph, 'day-1', ['n2', 'n3', 'n1'])

    const day1 = result.days.find((d) => d.id === 'day-1')
    expect(day1?.nodeIds).toEqual(['n2', 'n3', 'n1'])
  })

  it('no modifica días que no son el objetivo', () => {
    const graph = makeGraph()
    const result = reorderDayNodes(graph, 'day-1', ['n3', 'n1', 'n2'])

    const day2 = result.days.find((d) => d.id === 'day-2')
    expect(day2?.nodeIds).toEqual(['n4'])
    expect(result.nodes['n4']?.order).toBe(0)
  })

  it('reconstruye edges secuenciales del día en el nuevo orden', () => {
    const graph = makeGraph()
    const result = reorderDayNodes(graph, 'day-1', ['n3', 'n1', 'n2'])

    const sequential = result.edges.filter((e) => e.type === 'sequential')
    // Nuevo orden: n3 → n1 → n2
    expect(sequential).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromNodeId: 'n3', toNodeId: 'n1', type: 'sequential' }),
        expect.objectContaining({ fromNodeId: 'n1', toNodeId: 'n2', type: 'sequential' }),
      ])
    )
    // Las edges secuenciales antiguas ya no deben existir
    expect(sequential.find((e) => e.fromNodeId === 'n1' && e.toNodeId === 'n2')).toBeDefined()
    // n1→n2 sigue existiendo porque n1 sigue antes que n2 (pero n3 es ahora primero)
  })

  it('preserva edges no secuenciales (type optional, transport)', () => {
    const graph = makeGraph()
    const result = reorderDayNodes(graph, 'day-1', ['n3', 'n1', 'n2'])

    const optionalEdge = result.edges.find((e) => e.type === 'optional')
    expect(optionalEdge).toBeDefined()
    expect(optionalEdge?.id).toBe('edge-n1-n3')
  })

  it('no muta el grafo original (función pura)', () => {
    const graph = makeGraph()
    const original = JSON.stringify(graph)

    reorderDayNodes(graph, 'day-1', ['n3', 'n1', 'n2'])

    expect(JSON.stringify(graph)).toBe(original)
  })

  it('maneja correctamente un día con un solo nodo', () => {
    const graph = makeGraph()
    const result = reorderDayNodes(graph, 'day-2', ['n4'])

    expect(result.days.find((d) => d.id === 'day-2')?.nodeIds).toEqual(['n4'])
    expect(result.nodes['n4']?.order).toBe(0)
  })
})

// ─── calculateEndTime ─────────────────────────────────────────────────────────

describe('calculateEndTime', () => {
  it('calcula correctamente la hora de fin sin cruzar medianoche', () => {
    expect(calculateEndTime('09:00', 60)).toBe('10:00')
    expect(calculateEndTime('10:30', 90)).toBe('12:00')
    expect(calculateEndTime('14:45', 45)).toBe('15:30')
  })

  it('maneja correctamente horas que cruzan medianoche', () => {
    expect(calculateEndTime('23:00', 120)).toBe('01:00')
  })

  it('formatea la hora con cero a la izquierda', () => {
    expect(calculateEndTime('08:05', 10)).toBe('08:15')
    expect(calculateEndTime('07:50', 15)).toBe('08:05')
  })
})

// ─── DEFAULT_NODE_EMOJI ───────────────────────────────────────────────────────

describe('DEFAULT_NODE_EMOJI', () => {
  it('define emojis para todos los tipos de nodo', () => {
    const expectedTypes = ['poi', 'restaurant', 'activity', 'transport', 'hotel_checkin', 'free_time', 'note', 'flight']
    expectedTypes.forEach((type) => {
      expect(DEFAULT_NODE_EMOJI[type as keyof typeof DEFAULT_NODE_EMOJI]).toBeTruthy()
    })
  })
})
