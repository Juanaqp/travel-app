import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useItineraryStore } from '@/stores/useItineraryStore'
import type { ItineraryGraph, TravelPace, BudgetTier } from '@travelapp/types'

export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error'

export type ItineraryStyle = 'cultural' | 'adventure' | 'gastronomy' | 'relax' | 'luxury'

export interface GenerateItineraryParams {
  tripId: string
  userRequest: string
  style: ItineraryStyle
  dates: { start: string; end: string }
  travelers: number
  pace: TravelPace
  budget: BudgetTier
  avoid?: string[]
}

interface UseGenerateItineraryResult {
  generate: (params: GenerateItineraryParams) => Promise<void>
  status: GenerationStatus
  error: string | null
  reset: () => void
}

// Traduce el mensaje técnico del backend a texto amigable para el usuario
const mapBackendError = (errorMsg: string): string => {
  if (errorMsg.includes('No autorizado') || errorMsg.includes('no autorizado'))
    return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (errorMsg.includes('schema') || errorMsg.includes('reintentos'))
    return 'No pudimos generar un itinerario válido. Intenta con una descripción más detallada.'
  if (errorMsg.includes('Timeout') || errorMsg.includes('tardó demasiado'))
    return 'La generación tardó demasiado. Inténtalo de nuevo.'
  if (errorMsg.includes('OPENAI_API_KEY'))
    return 'El servicio de IA no está configurado correctamente.'
  if (errorMsg.includes('OpenAI') || errorMsg.includes('disponible'))
    return 'El servicio de IA no está disponible. Inténtalo en unos minutos.'
  if (errorMsg.includes('Datos de entrada') || errorMsg.includes('inválidos'))
    return 'Los datos del viaje son incompletos. Verifica las fechas y vuelve a intentarlo.'
  return 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.'
}

export const useGenerateItinerary = (): UseGenerateItineraryResult => {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const setDraftGraph = useItineraryStore((s) => s.setDraftGraph)

  const generate = useCallback(
    async (params: GenerateItineraryParams) => {
      setStatus('loading')
      setError(null)

      try {
        const { data, error: fnError } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            userRequest: params.userRequest,
            context: {
              tripId: params.tripId,
              dates: params.dates,
              travelers: params.travelers,
              style: params.style,
              pace: params.pace,
              budget: params.budget,
              language: 'es',
              avoid: params.avoid?.length ? params.avoid : undefined,
            },
          },
        })

        if (fnError) {
          // En Supabase JS v2, data siempre es null para respuestas no-2xx.
          // El body del error HTTP está en fnError.context (el objeto Response).
          let backendMessage = fnError.message
          try {
            const httpError = fnError as unknown as { context?: { json?: () => Promise<{ error?: string }> } }
            if (typeof httpError.context?.json === 'function') {
              const body = await httpError.context.json()
              if (body?.error) backendMessage = body.error
            }
          } catch {
            // body no es JSON o ya fue consumido — usar mensaje del SDK
          }
          logger.error('Edge Function generate-itinerary falló', {
            error: fnError.message,
            backendMessage,
          })
          setError(mapBackendError(backendMessage))
          setStatus('error')
          return
        }

        // Validación defensiva: la respuesta debe tener estructura mínima de ItineraryGraph
        if (
          !data ||
          typeof data !== 'object' ||
          !('id' in data) ||
          !('days' in data) ||
          !('nodes' in data)
        ) {
          logger.error('Respuesta inesperada de generate-itinerary — estructura inválida', { data })
          setError('La respuesta del servidor no tiene el formato esperado.')
          setStatus('error')
          return
        }

        const graph = data as ItineraryGraph
        setDraftGraph(graph)
        logger.info('Itinerario generado y guardado como draft', {
          graphId: graph.id,
          tripId: params.tripId,
          totalNodes: graph.meta.totalNodes,
          generationMs: graph.meta.generationDurationMs,
        })
        setStatus('success')
      } catch (err) {
        logger.error('Error inesperado en useGenerateItinerary', { err })
        setError('Ocurrió un error inesperado. Por favor, inténtalo de nuevo.')
        setStatus('error')
      }
    },
    [setDraftGraph]
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return { generate, status, error, reset }
}
