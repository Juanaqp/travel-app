// Hook para obtener información detallada de un destino desde get-destination-info
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useToastStore } from '@/stores/useToastStore'
import type { DestinationInfo } from '@travelapp/types'

const STALE_TIME = 7 * 24 * 60 * 60 * 1000  // 7 días — igual que el cache de BD

// Llama a la Edge Function con el token de sesión actual
export const fetchDestinationInfo = async (destination: string): Promise<DestinationInfo> => {
  const { data: { session } } = await supabase.auth.getSession()

  const { data, error } = await supabase.functions.invoke<DestinationInfo>('get-destination-info', {
    body: { destination },
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  })

  if (error) {
    logger.error('Error al obtener información del destino', { error, destination })
    throw error
  }

  if (!data) {
    throw new Error('Respuesta vacía de get-destination-info')
  }

  return data
}

// Parsea el código de error HTTP de la respuesta de FunctionsHttpError
const extractErrorStatus = (error: unknown): number | null => {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: { status?: number } }).context
    return ctx?.status ?? null
  }
  return null
}

export const useDestinationInfo = (destination: string | null) => {
  const showToast = useToastStore.getState().showToast

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['destination-info', destination],
    queryFn: () => fetchDestinationInfo(destination!),
    // Solo activar si hay destino — previene llamadas innecesarias
    enabled: !!destination,
    staleTime: STALE_TIME,
    retry: false,
  })

  // Mostrar toast según el código de error HTTP
  if (error) {
    const status = extractErrorStatus(error)
    if (status === 429) {
      showToast(
        'Has alcanzado el límite mensual de búsquedas con IA. Vuelve el próximo mes.',
        'warning'
      )
    } else if (status === 503) {
      showToast('No se pudo cargar la info del destino', 'error')
    }
  }

  return { info: data ?? null, isLoading, error, refetch }
}
