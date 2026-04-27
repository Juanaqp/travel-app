import type { ItineraryGraph, ItineraryEdge, NodeType } from '@travelapp/types'

// Reordena los nodos de un día y reconstruye las edges secuenciales afectadas.
// Función pura — no muta el grafo original.
export const reorderDayNodes = (
  graph: ItineraryGraph,
  dayId: string,
  newNodeIds: string[]
): ItineraryGraph => {
  // Actualizar el campo order en cada nodo del día
  const updatedNodes = { ...graph.nodes }
  newNodeIds.forEach((nodeId, idx) => {
    const node = updatedNodes[nodeId]
    if (node) {
      updatedNodes[nodeId] = { ...node, order: idx }
    }
  })

  // Reemplazar nodeIds del día con el nuevo orden
  const updatedDays = graph.days.map((day) =>
    day.id === dayId ? { ...day, nodeIds: newNodeIds } : day
  )

  // Eliminar solo las edges secuenciales que conectan nodos de este día
  const dayNodeSet = new Set(newNodeIds)
  const preservedEdges = graph.edges.filter(
    (e) =>
      e.type !== 'sequential' ||
      !dayNodeSet.has(e.fromNodeId) ||
      !dayNodeSet.has(e.toNodeId)
  )

  // Reconstruir edges secuenciales para el nuevo orden del día
  const newSequentialEdges: ItineraryEdge[] = []
  for (let i = 0; i < newNodeIds.length - 1; i++) {
    const fromId = newNodeIds[i]
    const toId = newNodeIds[i + 1]
    if (updatedNodes[fromId] && updatedNodes[toId]) {
      newSequentialEdges.push({
        id: `edge-${fromId}-${toId}`,
        fromNodeId: fromId,
        toNodeId: toId,
        type: 'sequential',
      })
    }
  }

  return {
    ...graph,
    days: updatedDays,
    nodes: updatedNodes,
    edges: [...preservedEdges, ...newSequentialEdges],
  }
}

// Calcula la hora de fin dado el inicio y la duración en minutos
export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const parts = startTime.split(':')
  const hours = parseInt(parts[0] ?? '0', 10)
  const minutes = parseInt(parts[1] ?? '0', 10)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMins = totalMinutes % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
}

// Emoji por defecto según el tipo de nodo
export const DEFAULT_NODE_EMOJI: Record<NodeType, string> = {
  poi: '📍',
  restaurant: '🍽️',
  activity: '🎯',
  transport: '🚶',
  hotel_checkin: '🏨',
  free_time: '☀️',
  note: '📝',
  flight: '✈️',
}
