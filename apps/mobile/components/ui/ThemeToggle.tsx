// Control segmentado de tres vías para cambiar el tema de la app
// Segmentos: Sol (light) | Auto (sigue al sistema) | Luna (dark)

import { View, Pressable, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import type { ThemePreference } from '@/stores/useThemeStore'

// Tipo del nombre de icono aceptado por Ionicons
type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

interface Segment {
  id: ThemePreference
  icon?: IoniconsName
  label?: string
  accessibilityLabel: string
}

const SEGMENTS: Segment[] = [
  { id: 'light', icon: 'sunny-outline',   accessibilityLabel: 'Tema claro' },
  { id: 'auto',  label: 'Auto',           accessibilityLabel: 'Tema automático (sigue al sistema)' },
  { id: 'dark',  icon: 'moon-outline',    accessibilityLabel: 'Tema oscuro' },
]

export interface ThemeToggleProps {
  // Sin props requeridas — lee y escribe directamente desde useTheme()
}

/**
 * Control segmentado para cambiar la preferencia de tema.
 * El segmento activo tiene fondo coral con texto/icono blanco.
 * Los inactivos son transparentes con texto secundario.
 * Altura fija de 36px, ancho se ajusta al contenido.
 */
export const ThemeToggle = (_: ThemeToggleProps) => {
  const { colors, preference, setPreference } = useTheme()

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Seleccionar tema"
    >
      {SEGMENTS.map((seg, index) => {
        const isActive = preference === seg.id
        const isFirst = index === 0
        const isLast = index === SEGMENTS.length - 1

        return (
          <Pressable
            key={seg.id}
            onPress={() => setPreference(seg.id)}
            accessibilityRole="radio"
            accessibilityLabel={seg.accessibilityLabel}
            accessibilityState={{ checked: isActive }}
            style={[
              styles.segment,
              isActive && { backgroundColor: colors.primary },
              isFirst && styles.segmentFirst,
              isLast && styles.segmentLast,
            ]}
          >
            {seg.icon ? (
              <Ionicons
                name={seg.icon}
                size={16}
                color={isActive ? '#FFFFFF' : colors.text.secondary}
              />
            ) : (
              <Text
                style={[
                  styles.segmentLabel,
                  { color: isActive ? '#FFFFFF' : colors.text.secondary },
                ]}
              >
                {seg.label}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    height: 36,
  },
  segment: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  segmentFirst: {
    borderTopLeftRadius: theme.radius.full,
    borderBottomLeftRadius: theme.radius.full,
  },
  segmentLast: {
    borderTopRightRadius: theme.radius.full,
    borderBottomRightRadius: theme.radius.full,
  },
  segmentLabel: {
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.medium,
  },
})
