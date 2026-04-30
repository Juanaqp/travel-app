// Header reutilizable para pantallas de la app Roamly
// Soporta botón de retroceso, acciones derecha, modo transparente y título grande

import { View, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/constants/icons'

/** Definición de una acción en el lado derecho del header */
export interface HeaderAction {
  /** Icono del registro de iconos */
  icon: IconName
  /** Callback al presionar */
  onPress: () => void
  /** Etiqueta de accesibilidad */
  label: string
}

export interface HeaderProps {
  /** Título principal */
  title: string
  /** Subtítulo opcional bajo el título */
  subtitle?: string
  /** Muestra el chevron de retroceso a la izquierda — llama router.back() */
  showBack?: boolean
  /** Una acción en el lado derecho */
  rightAction?: HeaderAction
  /** Hasta 2 acciones en el lado derecho (sobreescribe rightAction) */
  rightActions?: HeaderAction[]
  /** Sin fondo — para pantallas con imagen hero */
  transparent?: boolean
  /** Título en formato grande (30px/bold) como iOS */
  large?: boolean
}

/**
 * Header de pantalla del sistema Roamly.
 * - Modo claro: fondo blanco con borde inferior
 * - Modo oscuro: colors.background.elevated sin borde
 * - transparent: sin fondo, iconos y texto blancos
 * - large: título a 30px bold con alineación izquierda
 */
export const Header = ({
  title,
  subtitle,
  showBack = false,
  rightAction,
  rightActions,
  transparent = false,
  large = false,
}: HeaderProps) => {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  // Resolver color de texto e iconos según transparent
  const contentColor = transparent ? '#FFFFFF' : colors.text.primary

  // Las acciones a mostrar — rightActions tiene prioridad sobre rightAction
  const actions = rightActions ?? (rightAction ? [rightAction] : [])

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (large ? theme.spacing.sm : 0),
          backgroundColor: transparent
            ? 'transparent'
            : isDark
            ? colors.background.elevated
            : '#FFFFFF',
          borderBottomWidth: transparent || isDark ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Fila de navegación: back — título compacto — acciones */}
      {!large && (
        <View style={styles.row}>
          {/* Lado izquierdo */}
          <View style={styles.side}>
            {showBack && (
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Volver"
                hitSlop={8}
                style={styles.backButton}
              >
                <Icon name="back" size="lg" color={contentColor} />
              </Pressable>
            )}
          </View>

          {/* Título centrado */}
          <Text
            variant="subheading"
            color={contentColor}
            align="center"
            numberOfLines={1}
            style={styles.compactTitle}
          >
            {title}
          </Text>

          {/* Lado derecho — acciones */}
          <View style={[styles.side, styles.rightSide]}>
            {actions.slice(0, 2).map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                hitSlop={8}
                style={styles.actionButton}
              >
                <Icon name={action.icon} size="lg" color={contentColor} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Título grande (iOS-style): siempre a la izquierda */}
      {large && (
        <>
          {/* Fila superior con back y acciones cuando large */}
          {(showBack || actions.length > 0) && (
            <View style={styles.row}>
              <View style={styles.side}>
                {showBack && (
                  <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                    hitSlop={8}
                    style={styles.backButton}
                  >
                    <Icon name="back" size="lg" color={contentColor} />
                  </Pressable>
                )}
              </View>
              <View style={{ flex: 1 }} />
              <View style={[styles.side, styles.rightSide]}>
                {actions.slice(0, 2).map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={action.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    hitSlop={8}
                    style={styles.actionButton}
                  >
                    <Icon name={action.icon} size="lg" color={contentColor} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {/* Título e-book style a la izquierda */}
          <View style={styles.largeTitleBlock}>
            <Text
              variant="heading"
              weight="bold"
              color={contentColor}
              style={styles.largeTitle}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                variant="body"
                color={transparent ? 'rgba(255,255,255,0.75)' : colors.text.secondary}
                style={styles.subtitle}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </>
      )}

      {/* Subtítulo para header compacto */}
      {!large && subtitle && (
        <Text
          variant="caption"
          color={transparent ? 'rgba(255,255,255,0.75)' : colors.text.secondary}
          align="center"
          style={styles.compactSubtitle}
        >
          {subtitle}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: theme.spacing.md,
  },
  side: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSide: {
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  backButton: {
    padding: theme.spacing.xs,
    marginLeft: -theme.spacing.xs,
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
  compactTitle: {
    flex: 1,
  },
  compactSubtitle: {
    marginBottom: theme.spacing.xs,
  },
  largeTitleBlock: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  largeTitle: {
    fontSize: theme.typography.size.xxl,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
})
