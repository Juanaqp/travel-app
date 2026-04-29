import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'

// Layout de onboarding — solo verifica autenticación (sin verificar onboarding_completed
// para evitar bucles de redirección con el layout de (app))
export default function OnboardingLayout() {
  const { session, isInitialized } = useAuthStore()

  if (!isInitialized) return null

  // Si no hay sesión, el usuario debe autenticarse primero
  if (!session) {
    return <Redirect href="/(auth)" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
