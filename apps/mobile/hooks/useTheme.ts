// Hook de tema — devuelve colores, tipografía y tokens resueltos para el esquema actual
// Combina la preferencia guardada en useThemeStore con el esquema del sistema operativo

import { useColorScheme } from 'react-native'
import { theme } from '@/constants/theme'
import type { ThemeColors, ColorScheme } from '@/constants/theme'
import { useThemeStore } from '@/stores/useThemeStore'
import type { ThemePreference } from '@/stores/useThemeStore'

export interface UseThemeReturn {
  /** Esquema de color efectivo (resuelto, nunca 'auto') */
  colorScheme: ColorScheme
  /** Preferencia guardada por el usuario ('light' | 'dark' | 'auto') */
  preference: ThemePreference
  /** Cambia la preferencia de tema y la persiste */
  setPreference: (p: ThemePreference) => void
  /** true si el esquema activo es oscuro */
  isDark: boolean
  /** Paleta de colores del esquema activo */
  colors: ThemeColors
  /** Escala tipográfica, pesos y alturas de línea */
  typography: typeof theme.typography
  /** Espaciado en 8pt grid */
  spacing: typeof theme.spacing
  /** Radios de borde */
  radius: typeof theme.radius
  /** Sombras (aplicar solo en modo claro — en oscuro usar borde) */
  shadows: typeof theme.shadows
}

/**
 * Provee acceso a todos los tokens de diseño del esquema activo.
 * En modo 'auto' usa useColorScheme() de React Native para seguir al sistema.
 */
export const useTheme = (): UseThemeReturn => {
  const { preference, setPreference } = useThemeStore()
  const systemScheme = useColorScheme()

  // Resolver el esquema efectivo: si 'auto', delegar al sistema; si null, usar 'light'
  const colorScheme: ColorScheme =
    preference === 'auto' ? (systemScheme ?? 'light') : preference

  const isDark = colorScheme === 'dark'
  const colors: ThemeColors = theme.colors[colorScheme]

  return {
    colorScheme,
    preference,
    setPreference,
    isDark,
    colors,
    typography: theme.typography,
    spacing: theme.spacing,
    radius: theme.radius,
    shadows: theme.shadows,
  }
}
