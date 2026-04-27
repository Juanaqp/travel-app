import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { ItineraryGraph } from '@travelapp/types'

// Itinerario aprobado persistido en BD — distinto del draft en Zustand
export interface SavedItinerary {
  id: string
  tripId: string
  graph: ItineraryGraph
  generatedBy: string
  userPrompt: string
  createdAt: string
  updatedAt: string
}

// Obtiene el itinerario aprobado más reciente de un viaje
export const fetchLatestItinerary = async (tripId: string): Promise<SavedItinerary | null> => {
  const { data, error } = await supabase
    .from('itineraries')
    .select('id, trip_id, graph, generated_by, user_prompt, created_at, updated_at')
    .eq('trip_id', tripId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error('Error al obtener itinerario del viaje', { error, tripId })
    throw error
  }

  if (!data) return null

  return {
    id: data.id as string,
    tripId: data.trip_id as string,
    graph: data.graph as ItineraryGraph,
    generatedBy: data.generated_by as string,
    userPrompt: data.user_prompt as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

export const useItinerary = (tripId: string) => {
  return useQuery({
    queryKey: ['itinerary', tripId],
    queryFn: () => fetchLatestItinerary(tripId),
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}
