// Placeholder animado para estados de carga
// Reemplaza al LoadingSkeleton — soporta dimensiones y radios personalizados

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle, DimensionValue } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'

export type SkeletonRadius = 'sm' | 'md' | 'lg' | 'full'

export interface SkeletonProps {
  /** Ancho del placeholder (número de píxeles o string '100%') */
  width?: DimensionValue
  /** Alto del placeholder en píxeles */
  height?: number
  /** Radio de borde predefinido */
  radius?: SkeletonRadius
  /** Estilos adicionales */
  style?: StyleProp<ViewStyle>
}

/**
 * Placeholder de carga con animación shimmer (opacidad 0.3 → 0.8 en loop).
 * Usa colors.background.surface del tema activo como color base.
 */
export const Skeleton = ({
  width = '100%',
  height = 80,
  radius = 'md',
  style,
}: SkeletonProps) => {
  const { colors } = useTheme()
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  const borderRadius = theme.radius[radius]

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.background.surface,
          opacity,
        },
        style,
      ]}
      accessibilityElementsHidden
      accessibilityRole="none"
    />
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
})
