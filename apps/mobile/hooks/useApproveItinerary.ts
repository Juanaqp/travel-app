import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useItineraryStore } from '@/stores/useItineraryStore'
import {
  scheduleCheckinReminder,
  scheduleAirportReminder,
  scheduleDailySummary,
  requestPermissions,
} from '@/lib/notifications'
import { saveItineraryOffline } from '@/lib/offline/reader'
import type { ItineraryGraph, NodeUserStatus, FlightNode } from '@travelapp/types'

export interface ApproveItineraryParams {
  tripId: string
  draftGraph: ItineraryGraph
}

export interface ApproveItineraryResult {
  itineraryId: string
}

// Tipo de la fila retornada por el INSERT de itineraries
interface ItineraryRow {
  id: string
}

const getAuthenticatedUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user
}

// Mapea el estado del nodo al enum ai_feedback_action de la BD
const mapUserStatusToFeedbackAction = (
  status: NodeUserStatus
): 'approved' | 'rejected' | 'modified' => {
  if (status === 'rejected') return 'rejected'
  if (status === 'modified') return 'modified'
  return 'approved'  // 'pending' y 'approved' se tratan como aprobados al confirmar
}

// ─── Función pura — exportada para tests ─────────────────────────────────────

export const approveItinerary = async (
  params: ApproveItineraryParams
): Promise<ApproveItineraryResult> => {
  const user = await getAuthenticatedUser()

  // 1. Persistir el itinerario aprobado en BD
  const { data: itinerary, error: itineraryError } = await supabase
    .from('itineraries')
    .insert({
      trip_id: params.tripId,
      user_id: user.id,
      status: 'approved',
      graph: params.draftGraph,
      generated_by: params.draftGraph.generatedBy,
      user_prompt: params.draftGraph.userPrompt,
    })
    .select('id')
    .single()

  if (itineraryError || !itinerary) {
    logger.error('Error al persistir itinerario aprobado', {
      error: itineraryError,
      tripId: params.tripId,
    })
    throw itineraryError ?? new Error('No se recibió el ID del itinerario creado')
  }

  const { id: itineraryId } = itinerary as ItineraryRow

  // 2. Registrar feedback por cada nodo del itinerario
  const feedbackRecords = Object.values(params.draftGraph.nodes).map((node) => ({
    user_id: user.id,
    trip_id: params.tripId,
    itinerary_id: itineraryId,
    node_id: node.id,
    action: mapUserStatusToFeedbackAction(node.userStatus),
    original_content: node,
    // Solo se guarda el contenido modificado si el nodo fue editado por el usuario
    modified_content: node.isUserModified ? node : {},
  }))

  if (feedbackRecords.length > 0) {
    const { error: feedbackError } = await supabase
      .from('ai_feedback')
      .insert(feedbackRecords)

    if (feedbackError) {
      // El itinerario ya se guardó — el feedback es auxiliar y no debe bloquear al usuario
      logger.warn('Error al registrar ai_feedback — itinerario guardado correctamente', {
        error: feedbackError,
        itineraryId,
      })
    }
  }

  logger.info('Itinerario aprobado y persistido en BD', {
    itineraryId,
    tripId: params.tripId,
    totalNodes: params.draftGraph.meta.totalNodes,
  })

  // Guardar en caché offline
  saveItineraryOffline(itineraryId, params.tripId, params.draftGraph).catch(() => {})

  // Programar notificaciones si el usuario tiene permisos
  const hasPermission = await requestPermissions()
  if (hasPermission) {
    const destinationTz = params.draftGraph.destinationTimezone ?? 'UTC'

    // Notificaciones de vuelo
    const flightNodes = Object.values(params.draftGraph.nodes).filter(
      (n): n is FlightNode => n.type === 'flight' && n.userStatus !== 'rejected'
    )
    for (const flight of flightNodes) {
      const departureIso = flight.isoTime ?? flight.departureTime
      if (!departureIso) continue
      const originTz = flight.timezone ?? destinationTz
      await scheduleCheckinReminder(params.tripId, flight.name, departureIso, originTz)
      await scheduleAirportReminder(params.tripId, flight.name, departureIso, originTz)
    }

    // Resumen diario para cada día
    for (const day of params.draftGraph.days) {
      const title = day.title ?? `Día ${day.dayNumber}`
      await scheduleDailySummary(params.tripId, title, day.date, destinationTz)
    }
  }

  return { itineraryId }
}

// ─── Hook React Query ─────────────────────────────────────────────────────────

export const useApproveItinerary = () => {
  const clearDraftGraph = useItineraryStore((s) => s.clearDraftGraph)

  return useMutation({
    mutationFn: approveItinerary,
    onSuccess: () => {
      // Borrar el draft del store después de persistir en BD
      clearDraftGraph()
    },
    onError: (error) => {
      logger.error('Mutation de aprobar itinerario falló', { error })
    },
  })
}
