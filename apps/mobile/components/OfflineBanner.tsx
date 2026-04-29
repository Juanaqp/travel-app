// Banner de estado offline
// Se muestra en la parte superior de las pantallas que soportan modo offline.

import { View, Text, Pressable, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

interface OfflineBannerProps {
  // Pasar false para suprimir el banner en pantallas que no lo necesitan
  visible?: boolean
}

export const OfflineBanner = ({ visible = true }: OfflineBannerProps) => {
  const { isOnline, isInternetReachable, pendingOperations, isSyncing, syncNow } =
    useNetworkStatus()

  const slideAnim = useRef(new Animated.Value(-48)).current

  // Calcular si estamos offline de verdad (o aún no determinado = no mostrar)
  const offline = isOnline === false || isInternetReachable === false

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: offline && visible ? 0 : -48,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [offline, visible, slideAnim])

  if (!offline || !visible) return null

  return (
    <Animated.View
      style={{ transform: [{ translateY: slideAnim }] }}
      className="absolute top-0 left-0 right-0 z-50 bg-amber-500 flex-row items-center justify-between px-4 py-2"
      accessibilityRole="alert"
      accessibilityLabel="Sin conexión a internet"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-lg">📡</Text>
        <View>
          <Text className="text-white font-semibold text-xs">Sin conexión</Text>
          {pendingOperations > 0 ? (
            <Text className="text-amber-100 text-xs">
              {pendingOperations} cambio{pendingOperations > 1 ? 's' : ''} pendiente{pendingOperations > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text className="text-amber-100 text-xs">Modo solo lectura</Text>
          )}
        </View>
      </View>

      {pendingOperations > 0 ? (
        <Pressable
          onPress={syncNow}
          disabled={isSyncing || isOnline !== true}
          className="rounded-lg bg-white/20 px-3 py-1 active:bg-white/30"
        >
          <Text className="text-white text-xs font-semibold">
            {isSyncing ? 'Sincronizando...' : 'Reintentar'}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}
