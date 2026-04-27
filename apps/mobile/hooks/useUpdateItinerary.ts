import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { ItineraryGraph } from '@travelapp/types'
import type { SavedItinerary } from './useItinerary'

export interface UpdateItineraryParams {
  itineraryId: string
  tripId: string
  graph: ItineraryGraph
}

// Reemplaza el grafo completo en BD — suficiente para MVP (jsonb_set sería más eficiente en V2)
export const updateItineraryGraph = async (params: UpdateItineraryParams): Promise<void> => {
  const { error } = await supabase
    .from('itineraries')
    .update({ graph: params.graph })
    .eq('id', params.itineraryId)

  if (error) {
    logger.error('Error al persistir cambios del itinerario', {
      error,
      itineraryId: params.itineraryId,
    })
    throw error
  }

  logger.info('Grafo del itinerario actualizado en BD', { itineraryId: params.itineraryId })
}

export const useUpdateItinerary = (tripId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateItineraryGraph,
    onSuccess: (_, variables) => {
      // Actualiza la caché sin refetch — el grafo local ya es el correcto
      queryClient.setQueryData<SavedItinerary | null>(
        ['itinerary', variables.tripId],
        (old) => (old ? { ...old, graph: variables.graph } : old)
      )
    },
    onError: (error) => {
      logger.error('Mutación de actualizar itinerario falló', { error })
      // Invalida la caché para forzar refetch y mantener consistencia con BD
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] })
    },
  })
}
