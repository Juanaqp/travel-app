import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'

// Protección de ruta — lee el estado del auth store (inicializado en root layout)
// No duplica el listener de onAuthStateChange: ya vive en useAuthStore.initialize()
export default function AppLayout() {
  const { session, isInitialized } = useAuthStore()

  // Mientras el primer evento de auth no llegó, no renderizar nada
  // (evita un flash de redirección a login antes de saber si hay sesión)
  if (!isInitialized) return null

  if (!session) {
    return <Redirect href="/(auth)" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
