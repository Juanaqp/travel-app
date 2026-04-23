import { TextInput, Text, View } from 'react-native'

interface InputProps {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  error?: string
  secureTextEntry?: boolean
  editable?: boolean
  accessibilityLabel?: string
}

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  editable = true,
  accessibilityLabel,
}: InputProps) => {
  const borderClass = error
    ? 'border-red-500'
    : 'border-slate-600 focus:border-indigo-500'

  return (
    <View className="w-full">
      <Text className="mb-1.5 text-sm font-medium text-slate-300">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        secureTextEntry={secureTextEntry}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="none"
        accessibilityState={{ disabled: !editable }}
        className={`rounded-xl border bg-slate-800 px-4 py-3 text-base text-white ${borderClass} ${!editable ? 'opacity-50' : 'opacity-100'}`}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="mt-1.5 text-sm text-red-400"
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}
