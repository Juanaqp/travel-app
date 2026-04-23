import { View, Text } from 'react-native'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  accessibilityLabel?: string
}

export const EmptyState = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  accessibilityLabel,
}: EmptyStateProps) => (
  <View
    accessibilityLabel={accessibilityLabel ?? title}
    className="flex-1 items-center justify-center px-8"
  >
    {/* Ilustración genérica como emoji grande */}
    <Text className="mb-4 text-6xl" accessibilityElementsHidden>
      ✈️
    </Text>

    <Text className="text-center text-xl font-bold text-white">
      {title}
    </Text>

    {subtitle ? (
      <Text className="mt-2 text-center text-sm text-slate-400">
        {subtitle}
      </Text>
    ) : null}

    {actionLabel && onAction ? (
      <View className="mt-6 w-full max-w-xs">
        <Button label={actionLabel} onPress={onAction} variant="primary" />
      </View>
    ) : null}
  </View>
)
