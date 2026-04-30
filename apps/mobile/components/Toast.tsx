import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { useToastStore } from '@/stores/useToastStore'
import type { ToastType } from '@/stores/useToastStore'

// ─── Icono por variante usando Ionicons directamente para semántica correcta ──

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TOAST_ICON: Record<ToastType, IoniconsName> = {
  success: 'checkmark-circle-outline',
  error: 'close-circle-outline',
  warning: 'warning-outline',
  info: 'information-circle-outline',
}

const TOAST_DURATION_MS = 3000
const FADE_MS = 200

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Toast ────────────────────────────────────────────────────────────────────

export const Toast = () => {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { message, type, visible, hideToast } = useToastStore()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-16)).current

  // Colores de fondo por variante
  const BG: Record<ToastType, string> = {
    success: colors.semantic.success,
    error: colors.semantic.danger,
    warning: colors.semantic.warning,
    info: colors.semantic.info,
  }

  // El texto de warning usa color oscuro para contraste sobre amber claro
  const textColor = type === 'warning' ? '#1A1A1A' : '#FFFFFF'

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0)
      translateY.setValue(-16)
      return
    }

    // Entrada: slide-down + fade-in
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

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -16,
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
      style={[
        styles.container,
        {
          top: insets.top + theme.spacing.sm,
          width: SCREEN_WIDTH - 32,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.toast, { backgroundColor: BG[type] }, theme.shadows.md]}>
        <Ionicons
          name={TOAST_ICON[type]}
          size={20}
          color={textColor}
          accessibilityElementsHidden
        />
        <Text
          variant="body"
          weight="medium"
          numberOfLines={3}
          style={[styles.message, { color: textColor }]}
        >
          {message}
        </Text>
        <Pressable
          onPress={hideToast}
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificación"
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={`${textColor}CC`} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    left: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  message: {
    flex: 1,
    lineHeight: 20,
  },
})
