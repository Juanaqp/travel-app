import { View, Text, Pressable } from 'react-native'

interface HeaderProps {
  title: string
  actionLabel?: string
  onAction?: () => void
  accessibilityLabel?: string
}

export const Header = ({ title, actionLabel, onAction, accessibilityLabel }: HeaderProps) => (
  <View
    accessibilityRole="header"
    accessibilityLabel={accessibilityLabel ?? title}
    className="flex-row items-center justify-between border-b border-slate-700 bg-slate-900 px-4 pb-4 pt-6"
  >
    <Text className="text-2xl font-bold text-white">
      {title}
    </Text>

    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        className="rounded-lg bg-indigo-500 px-3 py-1.5 active:bg-indigo-600"
      >
        <Text className="text-sm font-semibold text-white">
          {actionLabel}
        </Text>
      </Pressable>
    ) : null}
  </View>
)
