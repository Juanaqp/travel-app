// Botón principal del sistema Roamly
// Soporta 4 variantes, 3 tamaños, icono opcional, estado de carga y animación de escala

import { useRef } from 'react'
import { Pressable, ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/constants/icons'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  /** Etiqueta del botón */
  label: string
  onPress: () => void
  /** Estilo visual del botón */
  variant?: ButtonVariant
  /** Tamaño del botón */
  size?: ButtonSize
  /** Icono opcional del registro de iconos */
  icon?: IconName
  /** Posición del icono relativa al texto */
  iconPosition?: 'left' | 'right'
  /** Muestra ActivityIndicator en lugar del contenido — el botón mantiene su tamaño */
  loading?: boolean
  /** Deshabilita interacción y reduce opacidad */
  disabled?: boolean
  /** Ocupa todo el ancho disponible */
  fullWidth?: boolean
  /** Estilos adicionales aplicados al contenedor Animated.View */
  style?: StyleProp<ViewStyle>
}

/** Alturas por tamaño para mantener dimensión consistente durante loading */
const sizeConfig = {
  sm: { height: 36, paddingHorizontal: theme.spacing.sm + 4, fontSize: theme.typography.size.sm,  iconSize: 14 },
  md: { height: 48, paddingHorizontal: theme.spacing.md,     fontSize: theme.typography.size.base, iconSize: 16 },
  lg: { height: 56, paddingHorizontal: theme.spacing.lg,     fontSize: theme.typography.size.md,   iconSize: 20 },
} as const

/**
 * Botón del sistema Roamly.
 * - primary: fondo coral, texto blanco
 * - secondary: transparente, borde coral, texto coral
 * - ghost: transparente, texto primario, sin borde
 * - danger: fondo rojo semántico, texto blanco
 * La animación de escala 0.97 dura 150ms (theme.animation.fast).
 */
export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) => {
  const { colors } = useTheme()
  const scaleAnim = useRef(new Animated.Value(1)).current
  const isInactive = disabled || loading

  const handlePressIn = () => {
    if (isInactive) return
    Animated.timing(scaleAnim, {
      toValue: 0.97,
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

  // Resolver colores según variante y esquema de color activo
  const variantStyle = (() => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary,
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: '#FFFFFF',
        }
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
          textColor: colors.primary,
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: colors.text.primary,
        }
      case 'danger':
        return {
          backgroundColor: colors.semantic.danger,
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: '#FFFFFF',
        }
    }
  })()

  const { height, paddingHorizontal, fontSize, iconSize } = sizeConfig[size]

  const iconEl = icon ? (
    <Icon name={icon} size="sm" color={variantStyle.textColor} />
  ) : null

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={fullWidth ? styles.fullWidth : undefined}
    >
      <Animated.View
        style={[
          styles.container,
          {
            height,
            paddingHorizontal,
            backgroundColor: variantStyle.backgroundColor,
            borderWidth: variantStyle.borderWidth,
            borderColor: variantStyle.borderColor,
            opacity: isInactive ? 0.5 : 1,
            transform: [{ scale: scaleAnim }],
          },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'ghost' ? colors.primary : variantStyle.textColor}
          />
        ) : (
          <View style={styles.content}>
            {iconPosition === 'left' && iconEl}
            <Text
              style={[
                styles.label,
                {
                  fontSize,
                  color: variantStyle.textColor,
                  marginLeft: icon && iconPosition === 'left' ? theme.spacing.xs : 0,
                  marginRight: icon && iconPosition === 'right' ? theme.spacing.xs : 0,
                },
              ]}
            >
              {label}
            </Text>
            {iconPosition === 'right' && iconEl}
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: theme.typography.weight.semibold,
  },
  fullWidth: {
    width: '100%',
  },
})
