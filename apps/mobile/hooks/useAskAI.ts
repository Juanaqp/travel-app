// Hook one-shot para el buscador de inspiración en la pantalla Explorar.
// NO usa React Query — es una operación imperativa sin caché propio.
// Guarda el resultado en useExploreStore para persistirlo al navegar.
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useExploreStore } from '@/stores/useExploreStore'
import type { DestinationInfo } from '@travelapp/types'

export type AskAIStatus = 'idle' | 'loading' | 'result' | 'error'

interface UseAskAIReturn {
  search: (destination: string) => Promise<DestinationInfo | null>
  status: AskAIStatus
  error: string | null
  reset: () => void
}

export const useAskAI = (): UseAskAIReturn => {
  const [status, setStatus] = useState<AskAIStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const setLastSearchResult = useExploreStore((s) => s.setLastSearchResult)

  const search = async (destination: string): Promise<DestinationInfo | null> => {
    if (!destination.trim()) return null

    setStatus('loading')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { data, error: fnError } = await supabase.functions.invoke<DestinationInfo>(
        'get-destination-info',
        {
          body: { destination: destination.trim() },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      )

      if (fnError) throw fnError

      if (!data) throw new Error('Respuesta vacía del servidor')

      // Guardar en store para que persista al navegar de regreso a Explorar
      setLastSearchResult(data, destination.trim())
      setStatus('result')
      return data
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Error desconocido'
      logger.error('useAskAI: error al buscar destino', { error: err, destination })
      setError(msg)
      setStatus('error')
      return null
    }
  }

  const reset = () => {
    setStatus('idle')
    setError(null)
  }

  return { search, status, error, reset }
}
