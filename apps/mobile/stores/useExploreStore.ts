// Store de la pantalla Explorar — NO persistido (solo en memoria durante la sesión)
import { create } from 'zustand'
import type { DestinationInfo, Trip } from '@travelapp/types'

interface ExploreStore {
  // Viaje activo para los botones de acceso rápido
  activeTrip: Trip | null
  // Último resultado de búsqueda (para persistir al navegar entre pantallas)
  lastSearchResult: DestinationInfo | null
  // Query que produjo el último resultado
  lastSearchQuery: string

  setActiveTrip: (trip: Trip | null) => void
  setLastSearchResult: (result: DestinationInfo, query: string) => void
  clearSearch: () => void
}

export const useExploreStore = create<ExploreStore>((set) => ({
  activeTrip: null,
  lastSearchResult: null,
  lastSearchQuery: '',

  setActiveTrip: (trip) => set({ activeTrip: trip }),
  setLastSearchResult: (result, query) =>
    set({ lastSearchResult: result, lastSearchQuery: query }),
  clearSearch: () => set({ lastSearchResult: null, lastSearchQuery: '' }),
}))
