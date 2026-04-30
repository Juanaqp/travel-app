// Etiqueta pill para estados semánticos y categorías
// Adapta colores al esquema claro/oscuro activo

import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  /** Texto mostrado dentro del badge */
  label: string
  /** Variante semántica que determina el color */
  variant?: BadgeVariant
  /** Tamaño compacto o estándar */
  size?: BadgeSize
}

/** Opacidad del fondo por variante (usada para crear el tono pastel) */
const BG_ALPHA = 0.15

/**
 * Badge pill del sistema Roamly.
 * Los colores de fondo se derivan de los tokens semánticos del tema con 15% de opacidad.
 */
export const Badge = ({ label, variant = 'default', size = 'md' }: BadgeProps) => {
  const { colors } = useTheme()

  // Resolver color de acento según variante
  const accentColor = (() => {
    switch (variant) {
      case 'primary': return colors.primary
      case 'success': return colors.semantic.success
      case 'warning': return colors.semantic.warning
      case 'danger':  return colors.semantic.danger
      case 'info':    return colors.semantic.info
      default:        return colors.text.secondary
    }
  })()

  const isSmall = size === 'sm'

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${accentColor}${Math.round(BG_ALPHA * 255).toString(16).padStart(2, '0')}`,
          paddingHorizontal: isSmall ? theme.spacing.sm : 12,
          paddingVertical: isSmall ? 2 : theme.spacing.xs,
        },
      ]}
      accessibilityRole="text"
    >
      <Text
        style={[
          styles.label,
          {
            color: accentColor,
            fontSize: isSmall ? theme.typography.size.xs : theme.typography.size.sm,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
  },
  label: {
    fontWeight: theme.typography.weight.medium,
  },
})
