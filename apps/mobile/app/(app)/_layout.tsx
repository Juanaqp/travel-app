import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { useOnboarding } from '@/hooks/useOnboarding'

// Protección de rutas de la app:
// 1. Sin sesión → pantalla de login
// 2. Con sesión pero onboarding pendiente → flujo de onboarding
// 3. Con sesión y onboarding completado → app normal
export default function AppLayout() {
  const { session, isInitialized } = useAuthStore()
  const { onboardingCompleted, isLoading: isOnboardingLoading } = useOnboarding()

  // Esperar a que auth esté inicializado y (si hay sesión) a que cargue el estado de onboarding
  if (!isInitialized) return null
  if (!session) return <Redirect href="/(auth)" />

  // Mientras se consulta onboarding_completed en la BD, no mostrar nada
  // (evita flash de redirección incorrecta)
  if (isOnboardingLoading) return null

  // Usuario que no completó el onboarding → enviarlo al flujo de configuración
  if (onboardingCompleted === false) {
    return <Redirect href="/(onboarding)/setup" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
