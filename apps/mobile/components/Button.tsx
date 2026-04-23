import { Pressable, Text, ActivityIndicator, View } from 'react-native'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  isLoading?: boolean
  isDisabled?: boolean
  accessibilityLabel?: string
}

// Clases de contenedor por variante
const containerVariantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-indigo-500 active:bg-indigo-600',
  secondary: 'bg-slate-700 border border-slate-600 active:bg-slate-600',
  ghost: 'bg-transparent active:bg-slate-800',
  danger: 'bg-red-500 active:bg-red-600',
}

// Clases de texto por variante
const textVariantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'text-white',
  secondary: 'text-slate-200',
  ghost: 'text-indigo-400',
  danger: 'text-white',
}

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  isDisabled = false,
  accessibilityLabel,
}: ButtonProps) => {
  const isInactive = isLoading || isDisabled

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: isLoading }}
      className={`flex-row items-center justify-center rounded-xl px-4 py-3 ${containerVariantClasses[variant]} ${isInactive ? 'opacity-50' : 'opacity-100'}`}
    >
      {isLoading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#ffffff" />
          <Text className={`text-base font-semibold ${textVariantClasses[variant]}`}>
            {label}
          </Text>
        </View>
      ) : (
        <Text className={`text-base font-semibold ${textVariantClasses[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}
