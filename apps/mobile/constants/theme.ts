// Design tokens — fuente de verdad para colores, espaciado y radios
// Sincronizado con tailwind.config.js para valores que Tailwind no puede expresar directamente

// Tokens de color planos — usar estos en componentes
export const colors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSubtle: '#334155',
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  secondary: '#8B5CF6',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  border: '#334155',
  borderSubtle: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
} as const

// Espaciado en puntos de densidad independiente
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const

// Radios de borde
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const
