import { View } from 'react-native'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  accessibilityLabel?: string
}

export const Card = ({ children, className = '', accessibilityLabel }: CardProps) => (
  <View
    accessibilityLabel={accessibilityLabel}
    className={`rounded-xl border border-slate-700 bg-slate-800 p-4 ${className}`}
  >
    {children}
  </View>
)
