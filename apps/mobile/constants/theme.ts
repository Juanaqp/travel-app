// Design tokens — sincronizados con tailwind.config.js
// Fuente única de verdad para valores que no puede expresar Tailwind directamente

export const colors = {
  background: {
    primary: '#0F172A',
    secondary: '#1E293B',
    tertiary: '#334155',
  },
  brand: {
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    secondary: '#8B5CF6',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    muted: '#64748B',
  },
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  border: {
    default: '#334155',
    subtle: '#1E293B',
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const
