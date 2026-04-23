import { View, Animated } from 'react-native'
import { useEffect, useRef } from 'react'

interface LoadingSkeletonProps {
  count?: number
  height?: number
}

// Ítem individual con animación de pulso
const SkeletonItem = ({ height }: { height: number }) => {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    // Animación de pulso continua para indicar carga
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [opacity])

  return (
    <Animated.View
      style={{ opacity, height }}
      accessibilityRole="none"
      accessibilityElementsHidden
      className="mb-3 w-full rounded-xl bg-slate-700"
    />
  )
}

export const LoadingSkeleton = ({ count = 1, height = 80 }: LoadingSkeletonProps) => (
  <View accessibilityLabel="Cargando contenido" accessibilityRole="progressbar" className="w-full">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonItem key={index} height={height} />
    ))}
  </View>
)
