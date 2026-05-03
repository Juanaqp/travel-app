// Pantalla de transición para callbacks de Magic Link.
//
// Por qué existe JUNTO al handler de _layout.tsx y no en su lugar:
// El listener Linking.addEventListener en _layout.tsx solo captura deep links
// cuando la app ya está en memoria (foreground o background). Si el usuario toca
// el enlace con la app completamente cerrada, el sistema operativo lanza la app
// directamente en esta ruta —y el listener aún no existe— perdiendo los tokens.
// Esta pantalla cubre ese caso: Expo Router la renderiza antes de que se monte
// _layout.tsx, por lo que el deep link inicial nunca se descarta.

import { useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useToastStore } from '@/stores/useToastStore'
import { useTheme } from '@/hooks/useTheme'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'

// Extrae access_token y refresh_token del fragmento del deep link.
// Lógica idéntica a parseDeepLinkTokens en _layout.tsx para garantizar consistencia.
// URL esperada: travelapp://auth/callback#access_token=AT&refresh_token=RT&type=magiclink
const parseDeepLinkTokens = (url: string): { accessToken: string; refreshToken: string } | null => {
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

export default function AuthCallbackScreen() {
  const router = useRouter()
  const { showToast } = useToastStore()
  const { colors, spacing, typography } = useTheme()

  useEffect(() => {
    const processCallback = async () => {
      const url = await Linking.getInitialURL()

      if (!url) {
        logger.error('Callback de Magic Link alcanzado sin URL inicial', {})
        showToast('El enlace no es válido. Solicita uno nuevo.', 'error')
        router.replace('/(auth)')
        return
      }

      const tokens = parseDeepLinkTokens(url)

      if (!tokens) {
        logger.error('Callback de Magic Link sin tokens válidos en la URL', { url })
        showToast('El enlace ha expirado o es inválido. Solicita uno nuevo.', 'error')
        router.replace('/(auth)')
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })

      if (error) {
        logger.error('Error al establecer sesión desde callback de Magic Link', { error })
        showToast('El enlace ha expirado. Solicita uno nuevo.', 'error')
        router.replace('/(auth)')
        return
      }

      router.replace('/(app)/(tabs)')
    }

    processCallback()
  }, [])

  return (
    <ScreenWrapper scroll={false} padding={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: spacing.md, fontSize: typography.size.sm, color: colors.text.secondary }}>Verificando enlace...</Text>
      </View>
    </ScreenWrapper>
  )
}
