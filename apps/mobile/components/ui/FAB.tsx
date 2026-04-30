// Botón de acción flotante (FAB) para Roamly
// Soporta variante circular (solo icono) y variante pill (icono + label)

import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Text'
import type { IconName } from '@/constants/icons'

export interface FABProps {
  /** Icono del registro de iconos */
  icon: IconName
  /** Callback al presionar */
  onPress: () => void
  /** Label opcional — activa la variante pill extendida */
  label?: string
  /** Posición absoluta en la pantalla */
  position?: 'bottom-right' | 'bottom-center'
  /** Accesibilidad */
  accessibilityLabel?: string
}

/**
 * Floating Action Button de Roamly.
 * - Sin label: círculo de 56px
 * - Con label: pill auto-width (icono + texto)
 * - Fondo: colors.primary (coral)
 * - Animación de escala spring 0.94 en 150ms al presionar
 * - Sombra en modo claro; sin sombra en modo oscuro
 */
export const FAB = ({
  icon,
  onPress,
  label,
  position = 'bottom-right',
  accessibilityLabel,
}: FABProps) => {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      tension: 400,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 400,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }

  const bottomOffset = 24 + insets.bottom

  return (
    <Animated.View
      style={[
        styles.wrapper,
        position === 'bottom-center' ? styles.positionCenter : styles.positionRight,
        { bottom: bottomOffset },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? icon}
        style={[
          label ? styles.pill : styles.circle,
          {
            backgroundColor: colors.primary,
            ...(isDark ? {} : theme.shadows.lg),
          },
        ]}
      >
        <Icon name={icon} size="lg" color="#FFFFFF" />
        {label && (
          <Text
            variant="subheading"
            weight="semibold"
            color="#FFFFFF"
            style={styles.label}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 100,
  },
  positionRight: {
    right: 20,
  },
  positionCenter: {
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.size.sm,
  },
})
