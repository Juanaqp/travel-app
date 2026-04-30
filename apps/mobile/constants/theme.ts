// Design tokens del sistema Roamly
// Fuente de verdad para colores, tipografía, espaciado, radios, sombras y animaciones
// Importar siempre desde aquí — nunca hardcodear valores en componentes

export const theme = {
  colors: {
    light: {
      /** Color coral principal: CTAs, estados activos */
      primary: '#FF5A5F',
      background: {
        base: '#FFFFFF',
        surface: '#F7F7F7',
        elevated: '#FFFFFF',
      },
      text: {
        primary: '#1A1A1A',
        secondary: '#717171',
        tertiary: '#B0B0B0',
      },
      border: '#EBEBEB',
      semantic: {
        success: '#00A699',
        warning: '#FFB400',
        danger: '#FF5A5F',
        info: '#007AFF',
      },
      overlay: 'rgba(0,0,0,0.45)',
    },
    dark: {
      /** Coral ligeramente más claro para mejor contraste sobre fondos oscuros */
      primary: '#FF6B6F',
      background: {
        base: '#1C1C1E',
        surface: '#2C2C2E',
        elevated: '#3A3A3C',
      },
      text: {
        primary: '#F5F5F5',
        secondary: '#AEAEB2',
        tertiary: '#636366',
      },
      border: '#3A3A3C',
      semantic: {
        success: '#00A699',
        warning: '#FFB400',
        danger: '#FF5A5F',
        info: '#007AFF',
      },
      overlay: 'rgba(0,0,0,0.45)',
    },
  },

  typography: {
    /** SF Pro en iOS, Roboto en Android — sistema por defecto */
    size: {
      xs: 11,
      sm: 13,
      base: 15,
      md: 17,
      lg: 20,
      xl: 24,
      xxl: 30,
      xxxl: 38,
    },
    weight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
    },
  },

  /** Grilla de 8 puntos */
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  /** Sombras solo para modo claro — en oscuro se usan bordes */
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
    easing: 'ease-in-out' as const,
  },
} as const

/**
 * Tipo del conjunto de colores para un esquema.
 * Definido como interfaz con string para que light y dark sean ambos asignables.
 */
export interface ThemeColors {
  primary: string
  background: { base: string; surface: string; elevated: string }
  text: { primary: string; secondary: string; tertiary: string }
  border: string
  semantic: { success: string; warning: string; danger: string; info: string }
  overlay: string
}

/** Esquema de color resuelto */
export type ColorScheme = 'light' | 'dark'

// ─── Exports de compatibilidad para código existente ─────────────────────────
// Toast.tsx y otros componentes legacy importan `colors` directamente

export const colors = {
  success: theme.colors.light.semantic.success,
  warning: theme.colors.light.semantic.warning,
  danger: theme.colors.light.semantic.danger,
  info: theme.colors.light.semantic.info,
} as const

export const spacing = theme.spacing
export const radii = theme.radius
