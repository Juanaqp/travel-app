import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { ItineraryNode } from '@travelapp/types'
import type { SavedItinerary } from './useItinerary'

export interface EditNodeParams {
  // itineraryId: para nodos ya guardados en BD
  itineraryId?: string
  nodeId: string
  instruction: string
  // nodeData: para nodos en draft (no guardados aún) — omite lookup en BD
  nodeData?: ItineraryNode
}

export interface EditNodeResult {
  updatedNode: ItineraryNode
}

// Traduce errores técnicos del backend a mensajes amigables para el modal de edición
const mapEditError = (msg: string): string => {
  if (msg.includes('No autorizado') || msg.includes('no autorizado'))
    return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (msg.includes('Timeout') || msg.includes('tardó demasiado'))
    return 'La IA tardó demasiado. Inténtalo de nuevo.'
  if (msg.includes('OpenAI') || msg.includes('OPENAI') || msg.includes('401') || msg.includes('Unauthorized'))
    return 'El servicio de IA no está disponible ahora. Inténtalo en unos minutos.'
  if (msg.includes('nodo inválido') || msg.includes('JSON inválido'))
    return 'La IA devolvió un resultado inválido. Prueba con una instrucción más específica.'
  if (msg.includes('no encontrado') || msg.includes('No encontrado'))
    return 'El nodo o itinerario no fue encontrado. Recarga la pantalla.'
  if (msg.includes('No se pudo guardar') || msg.includes('actualizar'))
    return 'No se pudieron guardar los cambios. Inténtalo de nuevo.'
  if (msg.includes('formato inválido') || msg.includes('grafo'))
    return 'El itinerario tiene un formato inesperado. Recarga la pantalla.'
  return 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
}

// Función pura exportada para tests — llama a la Edge Function edit-node
export const editNode = async (params: EditNodeParams): Promise<ItineraryNode> => {
  const { data, error } = await supabase.functions.invoke('edit-node', {
    body: {
      ...(params.itineraryId ? { itineraryId: params.itineraryId } : {}),
      nodeId: params.nodeId,
      instruction: params.instruction,
      ...(params.nodeData ? { nodeData: params.nodeData } : {}),
    },
  })

  if (error) {
    // En Supabase JS v2, el body real está en error.context (objeto Response sin consumir).
    let rawMessage = error.message
    try {
      const httpError = error as unknown as { context?: Response }
      if (httpError.context && typeof httpError.context.json === 'function') {
        const body = await httpError.context.json() as { error?: string }
        if (body?.error) rawMessage = body.error
      }
    } catch {
      // body no es JSON o ya fue consumido
    }
    logger.error('Error al invocar Edge Function edit-node', { rawMessage, nodeId: params.nodeId })
    throw new Error(mapEditError(rawMessage))
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta inesperada del servidor')
  }

  // Verificar si la Edge Function devolvió un error en el body
  if ('error' in data && typeof data.error === 'string') {
    logger.error('Error de la Edge Function edit-node', { error: data.error, nodeId: params.nodeId })
    throw new Error(mapEditError(data.error))
  }

  return data as ItineraryNode
}

// Hook que integra la edición asistida por IA con la caché de React Query
export const useEditNode = (tripId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: editNode,
    onSuccess: (updatedNode) => {
      // Actualiza el nodo modificado en la caché local sin refetch completo
      queryClient.setQueryData<SavedItinerary | null>(
        ['itinerary', tripId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            graph: {
              ...old.graph,
              nodes: {
                ...old.graph.nodes,
                [updatedNode.id]: updatedNode,
              },
            },
          }
        }
      )

      logger.info('Nodo editado con IA actualizado en caché', { nodeId: updatedNode.id })
    },
    onError: (error) => {
      logger.error('Mutación de edición de nodo con IA falló', { error })
      // Invalida la caché para forzar refetch desde BD y mantener consistencia
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] })
    },
  })
}
