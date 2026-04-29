import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { UserProfile, UpdateUserProfileInput } from '@travelapp/types'

// ─── Mapeador de fila de BD a tipo del dominio ───────────────────────────────

const mapRowToProfile = (row: Record<string, unknown>): UserProfile => ({
  id: row.id as string,
  email: row.email as string,
  fullName: row.full_name as string | undefined,
  avatarUrl: row.avatar_url as string | undefined,
  plan: (row.plan ?? 'free') as UserProfile['plan'],
  aiMessagesUsedThisMonth: (row.ai_messages_used_this_month ?? 0) as number,
  aiMessagesLimit: (row.ai_messages_limit ?? 20) as number,
  aiMessagesResetAt: row.ai_messages_reset_at as string,
  preferredCurrency: (row.preferred_currency ?? 'USD') as string,
  preferredLanguage: (row.preferred_language ?? 'es') as string,
  timezone: (row.timezone ?? 'UTC') as string,
  travelInterests: (row.travel_interests ?? []) as UserProfile['travelInterests'],
  preferredPace: row.preferred_pace as UserProfile['preferredPace'],
  preferredBudget: row.preferred_budget as UserProfile['preferredBudget'],
  onboardingCompleted: (row.onboarding_completed ?? false) as boolean,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

// ─── Queries ──────────────────────────────────────────────────────────────────

export const fetchProfile = async (): Promise<UserProfile> => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Usuario no autenticado')
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    logger.error('Error al obtener perfil', { error, userId: user.id })
    throw error
  }

  return mapRowToProfile(data as Record<string, unknown>)
}

// Estadísticas derivadas de viajes e itinerarios — calculadas en el cliente
export interface ProfileStats {
  totalTrips: number
  countriesVisited: number
  itinerariesGenerated: number
  totalExpensesUSD: number
}

export const fetchProfileStats = async (): Promise<ProfileStats> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { totalTrips: 0, countriesVisited: 0, itinerariesGenerated: 0, totalExpensesUSD: 0 }

  const [tripsResult, itinerariesResult, expensesResult] = await Promise.all([
    supabase
      .from('trips')
      .select('destinations')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('itineraries')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('expenses')
      .select('amount, currency')
      .eq('user_id', user.id)
      .is('deleted_at', null),
  ])

  const trips = tripsResult.data ?? []
  const itineraries = itinerariesResult.data ?? []
  const expenses = expensesResult.data ?? []

  // Países únicos extraídos del campo destinations (array de objetos con country)
  const countries = new Set<string>()
  for (const trip of trips) {
    const destinations = trip.destinations as Array<{ country?: string }> | null
    if (Array.isArray(destinations)) {
      for (const dest of destinations) {
        if (dest.country) countries.add(dest.country)
      }
    }
  }

  // Suma de gastos — asumimos USD (conversión real en fase posterior)
  const totalExpensesUSD = expenses.reduce((acc, e) => {
    const amount = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount as string) || 0
    return acc + amount
  }, 0)

  return {
    totalTrips: trips.length,
    countriesVisited: countries.size,
    itinerariesGenerated: itineraries.length,
    totalExpensesUSD,
  }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export const PROFILE_QUERY_KEY = ['profile'] as const
export const PROFILE_STATS_QUERY_KEY = ['profile-stats'] as const

export const useProfile = () => {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

export const useProfileStats = () => {
  return useQuery({
    queryKey: PROFILE_STATS_QUERY_KEY,
    queryFn: fetchProfileStats,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateUserProfileInput): Promise<UserProfile> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Usuario no autenticado')

      const updatePayload: Record<string, unknown> = {}
      if (input.fullName     !== undefined) updatePayload.full_name         = input.fullName
      if (input.avatarUrl    !== undefined) updatePayload.avatar_url        = input.avatarUrl
      if (input.preferredCurrency !== undefined) updatePayload.preferred_currency = input.preferredCurrency
      if (input.preferredLanguage !== undefined) updatePayload.preferred_language = input.preferredLanguage
      if (input.timezone     !== undefined) updatePayload.timezone          = input.timezone
      if (input.travelInterests !== undefined) updatePayload.travel_interests = input.travelInterests
      if (input.preferredPace !== undefined) updatePayload.preferred_pace  = input.preferredPace
      if (input.preferredBudget !== undefined) updatePayload.preferred_budget = input.preferredBudget

      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        logger.error('Error al actualizar perfil', { error, userId: user.id })
        throw error
      }

      return mapRowToProfile(data as Record<string, unknown>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
    },
    onError: (error) => {
      logger.error('Mutation de actualización de perfil falló', { error })
    },
  })
}
