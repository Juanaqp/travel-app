import { View, Text } from 'react-native'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  accessibilityLabel?: string
}

// Clases de contenedor por variante semántica
const containerClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-700',
  success: 'bg-emerald-900',
  warning: 'bg-amber-900',
  danger: 'bg-red-900',
  info: 'bg-blue-900',
}

// Clases de texto por variante semántica
const textClasses: Record<BadgeVariant, string> = {
  default: 'text-slate-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
  info: 'text-blue-300',
}

export const Badge = ({ label, variant = 'default', accessibilityLabel }: BadgeProps) => (
  <View
    accessibilityRole="text"
    accessibilityLabel={accessibilityLabel ?? label}
    className={`self-start rounded-full px-3 py-1 ${containerClasses[variant]}`}
  >
    <Text className={`text-xs font-medium ${textClasses[variant]}`}>
      {label}
    </Text>
  </View>
)
