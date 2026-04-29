import { useEffect, useRef } from 'react'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { useToastStore } from '@/stores/useToastStore'
import { colors } from '@/constants/theme'
import type { ToastType } from '@/stores/useToastStore'

// ─── Tokens visuales por tipo ─────────────────────────────────────────────────

const TOAST_BG: Record<ToastType, string> = {
  success: colors.success,
  error: colors.danger,
  warning: colors.warning,
  info: colors.info,
}

const TOAST_EMOJI: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

const TOAST_DURATION_MS = 4000
const FADE_MS = 250

// ─── Componente ───────────────────────────────────────────────────────────────

export const Toast = () => {
  const { message, type, visible, hideToast } = useToastStore()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0)
      translateY.setValue(-20)
      return
    }

    // Animación de entrada: fade-in + deslizar hacia abajo
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]).start()

    // Auto-dismiss después del tiempo configurado
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
      ]).start(() => hideToast())
    }, TOAST_DURATION_MS)

    return () => clearTimeout(timer)
  }, [visible, hideToast, opacity, translateY])

  if (!visible) return null

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.toast, { backgroundColor: TOAST_BG[type] }]}>
        <Text style={styles.emoji} accessibilityElementsHidden>
          {TOAST_EMOJI[type]}
        </Text>
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        <Pressable
          onPress={hideToast}
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificación"
          hitSlop={8}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

// StyleSheet solo para los estilos de layout que NativeWind no puede animar
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emoji: {
    fontSize: 18,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  close: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
})
