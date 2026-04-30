// Wrapper estándar para todas las pantallas de Roamly
// Gestiona SafeArea, KeyboardAvoidingView, ScrollView y Header de forma consistente

import type { ReactNode } from 'react'
import { Platform, KeyboardAvoidingView, ScrollView, RefreshControl, View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Header } from '@/components/ui/Header'
import type { HeaderProps } from '@/components/ui/Header'

export interface ScreenWrapperProps {
  children: ReactNode
  /** Si true, envuelve el contenido en ScrollView */
  scroll?: boolean
  /** Props del Header — si se provee, renderiza Header en la parte superior */
  header?: HeaderProps
  /** Si true (por defecto), aplica padding horizontal md=16 al contenido */
  padding?: boolean
  /** Estado de actualización para pull-to-refresh (requiere onRefresh) */
  refreshing?: boolean
  /** Callback de pull-to-refresh — activa el RefreshControl en el ScrollView */
  onRefresh?: () => void
  /** Sobreescribe el color de fondo del tema */
  backgroundColor?: string
}

/**
 * Envuelve cada pantalla de Roamly con:
 * - SafeAreaView con edges bottom/left/right (el Header gestiona el top)
 * - KeyboardAvoidingView para pantallas con inputs
 * - ScrollView opcional con pull-to-refresh
 * - Header opcional en la parte superior
 */
export const ScreenWrapper = ({
  children,
  scroll = false,
  header,
  padding = true,
  refreshing = false,
  onRefresh,
  backgroundColor,
}: ScreenWrapperProps) => {
  const { colors } = useTheme()

  const resolvedBg = backgroundColor ?? colors.background.base
  const contentPadding = padding ? theme.spacing.md : 0

  // Si hay header, el top safe area lo maneja el Header con useSafeAreaInsets.
  // El SafeAreaView solo cubre bottom + sides.
  const safeAreaEdges = header
    ? (['bottom', 'left', 'right'] as const)
    : (['top', 'bottom', 'left', 'right'] as const)

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: contentPadding },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.staticContent, { paddingHorizontal: contentPadding }]}>
      {children}
    </View>
  )

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, { backgroundColor: resolvedBg }]}
    >
      {/* Header opcional — gestiona internamente el inset del status bar */}
      {header && <Header {...header} />}

      {/* KeyboardAvoidingView envuelve el contenido para inputs */}
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  staticContent: {
    flex: 1,
  },
})
