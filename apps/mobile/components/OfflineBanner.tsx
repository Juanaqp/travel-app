import { Animated, StyleSheet, View } from 'react-native'
import { useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

const BANNER_HEIGHT = 36

interface OfflineBannerProps {
  visible?: boolean
}

export const OfflineBanner = ({ visible = true }: OfflineBannerProps) => {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { isOnline, isInternetReachable, pendingOperations } = useNetworkStatus()

  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT)).current

  const offline = isOnline === false || isInternetReachable === false

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: offline && visible ? 0 : -BANNER_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [offline, visible, slideAnim])

  if (!offline || !visible) return null

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          top: insets.top,
          backgroundColor: colors.semantic.warning,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Sin conexión a internet"
    >
      {/* Lado izquierdo: icono + texto */}
      <View style={styles.left}>
        <Icon name="offline" size="sm" color="#FFFFFF" />
        <Text variant="caption" weight="semibold" color="#FFFFFF">
          No connection
        </Text>
      </View>

      {/* Lado derecho: cambios pendientes */}
      {pendingOperations > 0 ? (
        <View style={[styles.pendingPill, { backgroundColor: 'rgba(0,0,0,0.18)' }]}>
          <Text style={styles.pendingText}>
            {pendingOperations} change{pendingOperations !== 1 ? 's' : ''} pending
          </Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    zIndex: 50,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  pendingPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  pendingText: {
    fontSize: theme.typography.size.xs,
    color: '#FFFFFF',
    fontWeight: '500',
  },
})
