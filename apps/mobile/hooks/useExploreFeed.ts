// Hook para obtener el feed de destinos populares desde get-explore-feed
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { ExploreFeedResponse } from '@travelapp/types'

const STALE_TIME = 60 * 60 * 1000        // 1 hora — coincide con el cache de la Edge Function
const GC_TIME   = 24 * 60 * 60 * 1000   // 24 horas — persiste entre sesiones

// Llama a la Edge Function y devuelve la respuesta validada
export const fetchExploreFeed = async (): Promise<ExploreFeedResponse> => {
  const { data, error } = await supabase.functions.invoke<ExploreFeedResponse>('get-explore-feed')

  if (error) {
    logger.error('Error al obtener feed de exploración', { error })
    throw error
  }

  if (!data?.destinations) {
    throw new Error('Respuesta inválida de get-explore-feed')
  }

  // Mapear explícitamente para garantizar que no se filtran datos personales del servidor
  return {
    destinations: data.destinations.map(({ name, trip_count, image_url, continent }) => ({
      name,
      trip_count,
      image_url,
      continent,
    })),
    generated_at: data.generated_at,
  }
}

// Configuración del query exportada para poder verificar los valores en tests
export const EXPLORE_FEED_QUERY_CONFIG = {
  queryKey: ['explore-feed'] as const,
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
  // networkMode 'offlineFirst': ejecuta una vez offline y pausa si no hay cache.
  // React Query devuelve datos cacheados cuando no hay conexión sin llamar a queryFn.
  networkMode: 'offlineFirst' as const,
  retry: 1,
}

export const useExploreFeed = () => {
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    ...EXPLORE_FEED_QUERY_CONFIG,
    queryFn: fetchExploreFeed,
  })

  // isFromCache: hay datos y no estamos en el medio de un fetch activo
  const isFromCache = data !== undefined && !isFetching

  return {
    destinations: data?.destinations ?? [],
    generatedAt: data?.generated_at,
    isLoading,
    error,
    isFetching,
    isFromCache,
    refetch,
  }
}
