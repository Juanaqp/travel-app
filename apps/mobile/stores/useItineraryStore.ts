import { create } from 'zustand'
import type { ItineraryGraph, ItineraryNode } from '@travelapp/types'

interface ItineraryState {
  draftGraph: ItineraryGraph | null
}

interface ItineraryActions {
  setDraftGraph: (graph: ItineraryGraph) => void
  clearDraftGraph: () => void
  // Actualiza un nodo aplicando una función transformadora
  updateNode: (nodeId: string, updater: (node: ItineraryNode) => ItineraryNode) => void
}

type ItineraryStore = ItineraryState & ItineraryActions

// Draft vive solo en memoria — se persiste en BD cuando el usuario confirma el itinerario
export const useItineraryStore = create<ItineraryStore>((set) => ({
  draftGraph: null,

  setDraftGraph: (graph) => set({ draftGraph: graph }),

  clearDraftGraph: () => set({ draftGraph: null }),

  updateNode: (nodeId, updater) =>
    set((state) => {
      if (!state.draftGraph) return state
      const node = state.draftGraph.nodes[nodeId]
      if (!node) return state
      return {
        draftGraph: {
          ...state.draftGraph,
          nodes: {
            ...state.draftGraph.nodes,
            [nodeId]: updater(node),
          },
        },
      }
    }),
}))
