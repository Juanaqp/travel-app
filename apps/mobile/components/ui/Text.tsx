// Componente tipográfico base del sistema Roamly
// Mapea variantes semánticas a la escala tipográfica del tema

import { Text as RNText, StyleSheet } from 'react-native'
import type { StyleProp, TextStyle } from 'react-native'
import type { ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'

type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label'
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold'
type TextAlign = 'left' | 'center' | 'right'

/** Mapa de variante → tamaño y peso por defecto */
const variantMap: Record<TextVariant, { fontSize: number; fontWeight: TextStyle['fontWeight'] }> = {
  title:      { fontSize: theme.typography.size.xxxl, fontWeight: theme.typography.weight.bold },
  heading:    { fontSize: theme.typography.size.xl,   fontWeight: theme.typography.weight.bold },
  subheading: { fontSize: theme.typography.size.lg,   fontWeight: theme.typography.weight.semibold },
  body:       { fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.regular },
  caption:    { fontSize: theme.typography.size.sm,   fontWeight: theme.typography.weight.regular },
  label:      { fontSize: theme.typography.size.sm,   fontWeight: theme.typography.weight.medium },
}

export interface TextProps {
  children: ReactNode
  /** Variante semántica — define tamaño y peso base */
  variant?: TextVariant
  /** Sobreescribe el peso de la variante */
  weight?: TextWeight
  /** Sobreescribe el color (por defecto: colors.text.primary) */
  color?: string
  /** Alineación horizontal del texto */
  align?: TextAlign
  /** Número máximo de líneas antes de truncar con '…' */
  numberOfLines?: number
  /** Estilos adicionales */
  style?: StyleProp<TextStyle>
}

/**
 * Componente de texto del sistema de diseño Roamly.
 * Adapta colores automáticamente al esquema claro/oscuro activo.
 */
export const Text = ({
  children,
  variant = 'body',
  weight,
  color,
  align = 'left',
  numberOfLines,
  style,
}: TextProps) => {
  const { colors } = useTheme()
  const base = variantMap[variant]

  const fontWeight: TextStyle['fontWeight'] = weight
    ? theme.typography.weight[weight]
    : base.fontWeight

  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        styles.base,
        {
          fontSize: base.fontSize,
          fontWeight,
          color: color ?? colors.text.primary,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  )
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
})
