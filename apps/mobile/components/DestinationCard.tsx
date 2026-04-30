// Tarjeta de destino visual para la pantalla Explorar
// Soporta tamaño grande (200×260) y pequeño (160×200) con gradiente simulado

import { useState, useRef } from 'react'
import { Image, Pressable, View, StyleSheet, Animated } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import type { ExploreDestination } from '@travelapp/types'

export interface DestinationCardProps {
  destination: ExploreDestination
  size: 'large' | 'small'
  onPress: () => void
}

const CARD_SIZES = {
  large: { width: 200, height: 260 },
  small: { width: 160, height: 200 },
} as const

export const DestinationCard = ({ destination, size, onPress }: DestinationCardProps) => {
  const { colors } = useTheme()
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [imageLoaded, setImageLoaded] = useState(false)
  const { width, height } = CARD_SIZES[size]

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 400,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 400,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }

  const pillText = destination.trip_count > 0
    ? `${destination.trip_count} viajeros`
    : 'Popular'

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Ver destino ${destination.name}`}
      style={{ marginRight: theme.spacing.sm }}
    >
      <Animated.View
        style={[
          styles.card,
          { width, height, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Skeleton mientras carga la imagen */}
        {!imageLoaded && (
          <Skeleton
            width={width}
            height={height}
            radius="lg"
            style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.xl }]}
          />
        )}

        {/* Foto del destino */}
        {destination.image_url ? (
          <Image
            source={{ uri: destination.image_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.elevated }]}
          />
        )}

        {/* Gradiente simulado: espaciador transparente + bandas oscuras al bottom */}
        <View style={[StyleSheet.absoluteFill, styles.gradientContainer]}>
          <View style={{ flex: 1 }} />
          <View style={{ height: 20, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          <View style={{ height: 25, backgroundColor: 'rgba(0,0,0,0.22)' }} />
          <View style={{ height: 30, backgroundColor: 'rgba(0,0,0,0.42)' }} />
          <View style={{ height: 45, backgroundColor: 'rgba(0,0,0,0.65)' }} />
        </View>

        {/* Contenido sobre el gradiente */}
        <View style={styles.content}>
          {/* Pill coral */}
          <View style={[styles.pill, { backgroundColor: colors.primary }]}>
            <Text
              variant="caption"
              weight="semibold"
              color="#FFFFFF"
              style={styles.pillText}
            >
              {pillText}
            </Text>
          </View>
          <Text
            variant="body"
            weight="semibold"
            color="#FFFFFF"
            numberOfLines={1}
          >
            {destination.name}
          </Text>
          <Text
            variant="caption"
            color="rgba(255,255,255,0.8)"
            numberOfLines={1}
          >
            {destination.continent}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  )
}

/** Placeholder de carga para la lista de destinos */
export const DestinationCardSkeleton = ({ size }: { size: 'large' | 'small' }) => {
  const { width, height } = CARD_SIZES[size]
  return (
    <Skeleton
      width={width}
      height={height}
      radius="lg"
      style={{ marginRight: theme.spacing.sm, borderRadius: theme.radius.xl }}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
  },
  gradientContainer: {
    flexDirection: 'column',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.xs,
  },
  pillText: {
    fontSize: 11,
  },
})
