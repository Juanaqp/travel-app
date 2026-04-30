// Contenedor de tarjeta con sombra (modo claro) o borde (modo oscuro)
// Animación de escala al presionar cuando se provee onPress

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Pressable, View, Animated, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'

export interface CardProps {
  children: ReactNode
  /** Callback de toque — si se omite, la tarjeta es estática (no Pressable) */
  onPress?: () => void
  /** Estilos adicionales aplicados al contenedor */
  style?: StyleProp<ViewStyle>
  /** Aplica sombra md en lugar de sm en modo claro */
  elevated?: boolean
}

/**
 * Tarjeta del sistema Roamly.
 * - Modo claro: sombra sm/md según `elevated`
 * - Modo oscuro: borde de 1px en colors.border, sin sombra
 * - Con `onPress`: animación de escala 0.98 en 150ms al presionar
 */
export const Card = ({ children, onPress, style, elevated = false }: CardProps) => {
  const { colors, isDark, shadows } = useTheme()
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: theme.animation.fast,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: theme.animation.fast,
      useNativeDriver: true,
    }).start()
  }

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: colors.background.elevated,
      borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
      borderColor: isDark ? colors.border : 'transparent',
    },
    // Sombras solo en modo claro para mantener el aesthetic minimal en modo oscuro
    !isDark && (elevated ? shadows.md : shadows.sm),
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
      >
        <Animated.View style={[cardStyle, { transform: [{ scale: scaleAnim }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
})
