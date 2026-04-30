import { useEffect, useState } from 'react'
import { Redirect, Stack, usePathname } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTimezoneStore } from '@/stores/useTimezoneStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { getDb } from '@/lib/offline/db'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toast } from '@/components/Toast'
import { useTheme } from '@/hooks/useTheme'
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
// Flujo de navegación completo:
//   1ª apertura → /(welcome)/onboarding → /(auth) → /(onboarding)/setup → /(app)
//   Siguientes → /(app) directamente (o /(auth) si no hay sesión)
export default function RootLayout() {
  // null = verificando, true = ya visto, false = mostrar onboarding de bienvenida
  const [welcomeChecked, setWelcomeChecked] = useState(false)
  const [welcomeShown, setWelcomeShown] = useState(true)
  const pathname = usePathname() ?? ''

  // Resolver esquema de color activo para el StatusBar — debe llamarse antes de returns condicionales
  const { isDark } = useTheme()

  useEffect(() => {
    // Verificar onboarding de bienvenida ANTES del check de sesión de Supabase
    AsyncStorage.getItem('onboarding_shown')
      .then((val) => {
        setWelcomeShown(!!val)
        setWelcomeChecked(true)
      })
      .catch(() => {
        // En caso de error al leer storage, no bloquear el flujo normal
        setWelcomeChecked(true)
      })

    // Inicializar la BD SQLite offline en background
    getDb().catch((e) => logger.warn('SQLite no disponible', { error: e }))

    // Cargar timezone guardado en AsyncStorage
    useTimezoneStore.getState().loadFromStorage().catch(() => {})

    // Cargar preferencia de tema guardada en AsyncStorage
    useThemeStore.getState().loadFromStorage().catch(() => {})

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

  // Sin flash: esperar a que AsyncStorage resuelva antes de renderizar nada
  if (!welcomeChecked) return null

  // Primera apertura — mostrar slides de bienvenida antes de ir a auth
  if (!welcomeShown && !pathname.startsWith('/onboarding')) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Redirect href="/onboarding" />
        </GestureHandlerRootView>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
          {/* Toast fuera del navegador para que sea verdaderamente global */}
          <Toast />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
