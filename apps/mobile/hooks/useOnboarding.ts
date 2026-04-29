import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuthStore } from '@/stores/useAuthStore'
import type { OnboardingData } from '@travelapp/types'

// ─── Funciones puras — separadas del hook para facilitar tests ────────────────

// Consulta el estado de onboarding del usuario en la BD
export const fetchOnboardingStatus = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', userId)
    .single()

  if (error) {
    logger.error('Error al consultar estado de onboarding', { error, userId })
    throw error
  }

  // Si el registro no existe aún (race condition tras el primer login), tratar como no completado
  return data?.onboarding_completed ?? false
}

// Guarda los datos de onboarding y marca el perfil como completado
export const submitOnboardingData = async (
  userId: string,
  data: OnboardingData
): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({
      full_name: data.fullName,
      timezone: data.timezone,
      preferred_currency: data.preferredCurrency,
      preferred_pace: data.preferredPace,
      travel_interests: data.travelInterests,
      preferred_budget: data.preferredBudget,
      onboarding_completed: true,
    })
    .eq('id', userId)

  if (error) {
    logger.error('Error al guardar datos de onboarding', { error, userId })
    throw error
  }

  logger.info('Onboarding completado', { userId, timezone: data.timezone })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseOnboardingResult {
  // null mientras carga, true/false cuando hay dato
  onboardingCompleted: boolean | null
  isLoading: boolean
  isCompleting: boolean
  // Devuelve el estado actual del caché — útil en callbacks y layouts
  checkOnboardingStatus: () => boolean | null
  completeOnboarding: (data: OnboardingData) => Promise<void>
}

export const useOnboarding = (): UseOnboardingResult => {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data: onboardingCompleted, isLoading } = useQuery({
    queryKey: ['onboarding-status', userId],
    queryFn: () => fetchOnboardingStatus(userId!),
    enabled: !!userId,
    // El estado de onboarding no cambia por sí solo — solo invalida en completeOnboarding
    staleTime: Infinity,
    retry: 1,
  })

  const { mutateAsync, isPending: isCompleting } = useMutation({
    mutationFn: (data: OnboardingData) => submitOnboardingData(userId!, data),
    onSuccess: () => {
      // Invalida el caché para que el layout obtenga el nuevo estado
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      queryClient.setQueryData(['onboarding-status', userId], true)
    },
    onError: (error) => {
      logger.error('Fallo al completar onboarding', { error })
    },
  })

  const checkOnboardingStatus = (): boolean | null => {
    if (isLoading || onboardingCompleted === undefined) return null
    return onboardingCompleted
  }

  const completeOnboarding = async (data: OnboardingData): Promise<void> => {
    await mutateAsync(data)
  }

  return {
    onboardingCompleted: onboardingCompleted ?? null,
    isLoading,
    isCompleting,
    checkOnboardingStatus,
    completeOnboarding,
  }
}
