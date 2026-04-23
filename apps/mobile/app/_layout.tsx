import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuthStore } from '@/stores/useAuthStore'
import '../global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
})

// Extrae access_token y refresh_token del fragmento del deep link de Magic Link
// URL esperada: travelapp://#access_token=AT&refresh_token=RT&type=magiclink
function parseDeepLinkTokens(url: string): { accessToken: string; refreshToken: string } | null {
  try {
    const fragment = url.split('#')[1]
    if (!fragment) return null
    const params = new URLSearchParams(fragment)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return null
    return { accessToken, refreshToken }
  } catch {
    return null
  }
}

// Root layout — inicializa auth y gestiona deep links del Magic Link
export default function RootLayout() {
  useEffect(() => {
    // Inicializa el listener de auth — retorna cleanup para desmontar
    const cleanupAuth = useAuthStore.getState().initialize()

    // Procesa una URL de deep link (puede contener tokens de Magic Link)
    const handleDeepLink = async (url: string | null) => {
      if (!url) return
      const tokens = parseDeepLinkTokens(url)
      if (!tokens) return

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })
      if (error) {
        logger.error('Error al procesar el deep link de Magic Link', { error })
      }
    }

    // Maneja el deep link inicial (app abierta desde el email)
    Linking.getInitialURL().then(handleDeepLink)

    // Maneja deep links mientras la app está abierta en segundo plano
    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url)
    })

    return () => {
      cleanupAuth()
      urlSubscription.remove()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
