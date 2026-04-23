import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type {
  Trip,
  CreateTripInput,
  UpdateTripInput,
  TripStatus,
  TravelPace,
  BudgetTier,
  Destination,
} from '@travelapp/types'

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
    throw error
  }

  return (data as TripRow[]).map(mapRowToTrip)
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

  return mapRowToTrip(data as TripRow)
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

  return mapRowToTrip(data as TripRow)
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
    logger.error('Error al archivar viaje', { error, tripId })
    throw error
  }
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export const useTrips = () =>
  useQuery({
    queryKey: [TRIPS_QUERY_KEY],
    queryFn: fetchUserTrips,
    staleTime: 5 * 60 * 1000,
    retry: 2,
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
    },
  })
}
