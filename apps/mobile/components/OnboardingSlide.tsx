import { useEffect, useRef } from 'react'
import { Animated, View, Text, Dimensions } from 'react-native'
import type { ReactNode } from 'react'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface OnboardingSlideProps {
  illustration: ReactNode
  title: string
  subtitle: string
  isActive: boolean
}

// Componente de slide individual con animación de entrada fade + translateY
export const OnboardingSlide = ({ illustration, title, subtitle, isActive }: OnboardingSlideProps) => {
  const fadeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current
  const slideAnim = useRef(new Animated.Value(isActive ? 0 : 20)).current

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start()
    }
  }, [isActive, fadeAnim, slideAnim])

  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 items-center justify-center px-8">
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        className="w-full items-center"
      >
        {/* Ilustración SVG/componente */}
        <View className="mb-10 items-center justify-center">
          {illustration}
        </View>

        {/* Título */}
        <Text className="mb-3 text-center text-2xl font-bold text-white">
          {title}
        </Text>

        {/* Subtítulo */}
        <Text className="text-center text-base leading-6 text-slate-400">
          {subtitle}
        </Text>
      </Animated.View>
    </View>
  )
}
