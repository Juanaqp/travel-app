// Separador horizontal de 1px para dividir secciones de contenido

import { View, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'

export type DividerSpacing = 'sm' | 'md' | 'lg'

export interface DividerProps {
  /** Espacio vertical alrededor de la línea */
  spacing?: DividerSpacing
  /** Sobreescribe el color del borde */
  color?: string
}

/**
 * Línea divisoria de 1px que usa el color de borde del tema activo.
 * El spacing controla el margen vertical superior e inferior.
 */
export const Divider = ({ spacing = 'md', color }: DividerProps) => {
  const { colors } = useTheme()

  const verticalMargin = {
    sm: theme.spacing.sm,
    md: theme.spacing.md,
    lg: theme.spacing.lg,
  }[spacing]

  return (
    <View
      style={[
        styles.line,
        {
          marginVertical: verticalMargin,
          backgroundColor: color ?? colors.border,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
})
