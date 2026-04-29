import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useToastStore } from '@/stores/useToastStore'
import { saveTripsOffline, getTripsOffline } from '@/lib/offline/reader'
import { addPendingOperation } from '@/lib/offline/sync'
import { cancelAllTripNotifications } from '@/lib/notifications'
import type {
  Trip,
  CreateTripInput,
  UpdateTripInput,
  TripStatus,
  TravelPace,
  BudgetTier,
  Destination,
} from '@travelapp/types'

// Convierte base64 a Uint8Array para upload a Supabase Storage
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Sube imagen de portada al bucket trip-covers y retorna la URL pública
const uploadTripCover = async (
  tripId: string,
  userId: string,
  imageBase64: string,
  mimeType: string
): Promise<string> => {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${userId}/${tripId}/cover.${ext}`
  const fileBytes = base64ToUint8Array(imageBase64)

  const { error } = await supabase.storage
    .from('trip-covers')
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: true,  // permite reemplazar la portada existente
    })

  if (error) {
    logger.error('Error al subir imagen de portada del viaje', { error, tripId })
    throw error
  }

  const { data } = supabase.storage
    .from('trip-covers')
    .getPublicUrl(storagePath)

  return data.publicUrl
}

// Tipo del registro de BD — se reemplaza por Database['public']['Tables']['trips']['Row']
// cuando se genere packages/types/database.ts con `supabase gen types typescript --local`
type TripRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  cover_image_url: string | null
  status: string
  destinations: unknown
  start_date: string | null
  end_date: string | null
  travelers_count: number
  pace: string | null
  budget: string | null
  base_currency: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Convierte fila snake_case de BD al tipo camelCase del dominio
const mapRowToTrip = (row: TripRow): Trip => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  description: row.description ?? undefined,
  coverImageUrl: row.cover_image_url ?? undefined,
  status: row.status as TripStatus,
  destinations: (row.destinations as Destination[]) ?? [],
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
  travelersCount: row.travelers_count,
  pace: (row.pace as TravelPace) ?? undefined,
  budget: (row.budget as BudgetTier) ?? undefined,
  baseCurrency: row.base_currency,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// Obtiene el usuario autenticado — lanza si no hay sesión
const getAuthenticatedUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user
}

const TRIPS_QUERY_KEY = 'trips' as const

// ─── Funciones puras de BD — testeables independientemente del hook ──────────

// Obtiene todos los viajes activos del usuario (excluye soft deleted)
// Guarda el resultado en caché offline para uso sin conexión
export const fetchUserTrips = async (): Promise<Trip[]> => {
  const user = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Error al obtener lista de viajes', { error, userId: user.id })
    // Intentar retornar datos offline si falla la red
    const offlineData = await getTripsOffline()
    if (offlineData.length > 0) {
      logger.info('Retornando viajes desde caché offline', { count: offlineData.length })
      return offlineData
    }
    throw error
  }

  const trips = (data as TripRow[]).map(mapRowToTrip)
  // Actualizar caché offline en background
  saveTripsOffline(trips).catch(() => {})
  return trips
}

// Obtiene un viaje específico por ID
export const fetchTripById = async (id: string): Promise<Trip> => {
  const user = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (error) {
    logger.error('Error al obtener viaje', { error, tripId: id })
    throw error
  }

  return mapRowToTrip(data as TripRow)
}

// Inserta un nuevo viaje y retorna el registro creado
// Si se proporciona coverImageBase64, sube la portada al bucket trip-covers
export const createTrip = async (input: CreateTripInput): Promise<Trip> => {
  const user = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description,
      destinations: input.destinations,
      start_date: input.startDate,
      end_date: input.endDate,
      travelers_count: input.travelersCount ?? 1,
      pace: input.pace,
      budget: input.budget,
      base_currency: input.baseCurrency ?? 'USD',
      status: 'planning' satisfies TripStatus,
    })
    .select()
    .single()

  if (error) {
    logger.error('Error al crear viaje', { error, input })
    throw error
  }

  const trip = mapRowToTrip(data as TripRow)

  // Subir imagen de portada si se proporcionó — no bloquea si falla
  if (input.coverImageBase64 && input.coverImageMimeType) {
    try {
      const coverUrl = await uploadTripCover(trip.id, user.id, input.coverImageBase64, input.coverImageMimeType)
      const { data: updatedData, error: updateError } = await supabase
        .from('trips')
        .update({ cover_image_url: coverUrl })
        .eq('id', trip.id)
        .select()
        .single()
      if (!updateError && updatedData) {
        return mapRowToTrip(updatedData as TripRow)
      }
    } catch (coverError) {
      logger.warn('Portada no pudo subirse, viaje creado sin imagen de portada', { error: coverError, tripId: trip.id })
    }
  }

  return trip
}

// Actualiza campos específicos de un viaje
export const updateTrip = async (input: UpdateTripInput): Promise<Trip> => {
  const user = await getAuthenticatedUser()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.title !== undefined) updatePayload.title = input.title
  if (input.description !== undefined) updatePayload.description = input.description
  if (input.destinations !== undefined) updatePayload.destinations = input.destinations
  if (input.startDate !== undefined) updatePayload.start_date = input.startDate
  if (input.endDate !== undefined) updatePayload.end_date = input.endDate
  if (input.travelersCount !== undefined) updatePayload.travelers_count = input.travelersCount
  if (input.pace !== undefined) updatePayload.pace = input.pace
  if (input.budget !== undefined) updatePayload.budget = input.budget
  if (input.baseCurrency !== undefined) updatePayload.base_currency = input.baseCurrency
  if (input.status !== undefined) updatePayload.status = input.status

  const { data, error } = await supabase
    .from('trips')
    .update(updatePayload)
    .eq('id', input.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    logger.error('Error al actualizar viaje', { error, tripId: input.id })
    throw error
  }

  const trip = mapRowToTrip(data as TripRow)

  // Subir nueva imagen de portada si se proporcionó — no bloquea si falla
  if (input.coverImageBase64 && input.coverImageMimeType) {
    try {
      const coverUrl = await uploadTripCover(trip.id, user.id, input.coverImageBase64, input.coverImageMimeType)
      const { data: updatedData, error: updateError } = await supabase
        .from('trips')
        .update({ cover_image_url: coverUrl })
        .eq('id', trip.id)
        .select()
        .single()
      if (!updateError && updatedData) {
        return mapRowToTrip(updatedData as TripRow)
      }
    } catch (coverError) {
      logger.warn('Portada no pudo subirse, viaje actualizado sin imagen de portada', { error: coverError, tripId: trip.id })
    }
  }

  return trip
}

// Archiva un viaje vía soft delete — nunca borrado físico
export const archiveTrip = async (tripId: string): Promise<void> => {
  const user = await getAuthenticatedUser()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('trips')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', tripId)
    .eq('user_id', user.id)

  if (error) {
    // Encolar para sincronizar cuando vuelva la conexión
    await addPendingOperation('trips', 'delete', tripId, { deleted_at: now, updated_at: now })
    logger.warn('Archivar viaje encolado offline', { tripId })
  }

  // Cancelar notificaciones del viaje independientemente del resultado de red
  cancelAllTripNotifications(tripId).catch(() => {})
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export const useTrips = () =>
  useQuery({
    queryKey: [TRIPS_QUERY_KEY],
    queryFn: fetchUserTrips,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    throwOnError: false,
  })

export const useTrip = (id: string) =>
  useQuery({
    queryKey: [TRIPS_QUERY_KEY, id],
    queryFn: () => fetchTripById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

export const useCreateTrip = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRIPS_QUERY_KEY] })
      logger.info('Viaje creado — caché invalidado')
    },
    onError: (error) => {
      logger.error('Mutation de crear viaje falló', { error })
      useToastStore.getState().showToast('No se pudo crear el viaje. Inténtalo de nuevo.', 'error')
    },
  })
}

export const useUpdateTrip = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTrip,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TRIPS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [TRIPS_QUERY_KEY, variables.id] })
    },
    onError: (error) => {
      logger.error('Mutation de actualizar viaje falló', { error })
      useToastStore.getState().showToast('No se pudo actualizar el viaje.', 'error')
    },
  })
}

export const useArchiveTrip = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRIPS_QUERY_KEY] })
      logger.info('Viaje archivado — caché invalidado')
    },
    onError: (error) => {
      logger.error('Mutation de archivar viaje falló', { error })
      useToastStore.getState().showToast('No se pudo eliminar el viaje.', 'error')
    },
  })
}
