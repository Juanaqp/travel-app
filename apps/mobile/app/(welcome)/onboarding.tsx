import { useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { OnboardingSlide } from '@/components/OnboardingSlide'
import { logger } from '@/lib/logger'
import { useTheme } from '@/hooks/useTheme'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'
import { Button } from '@/components/ui/Button'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Ilustraciones inline con View primitives ────────────────────────────────

// Mapa estilizado con pins y ruta conectada
const MapIllustration = ({ colors }: { colors: any }) => (
  <View style={{ height: 208, width: 288, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.background.surface }}>
    {/* Fondo del mapa */}
    <View style={{ position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, borderRadius: 16, backgroundColor: colors.background.elevated, overflow: 'hidden' }}>
      {/* Líneas de calle horizontales */}
      <View style={{ position: 'absolute', top: 32, left: 0, right: 0, height: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 64, left: 0, right: 0, height: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 96, left: 0, right: 0, height: 1, backgroundColor: colors.border }} />
      {/* Líneas de calle verticales */}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 48, width: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 112, width: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, right: 48, width: 1, backgroundColor: colors.border }} />
    </View>

    {/* Pin de origen — verde */}
    <View style={{ position: 'absolute', top: 40, left: 64, height: 20, width: 20, borderRadius: 10, backgroundColor: colors.semantic.success, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: colors.text.primary }} />
    </View>

    {/* Línea de ruta */}
    <View style={{ position: 'absolute', top: 56, left: 80, height: 2, width: 80, backgroundColor: colors.primary, opacity: 0.8 }} />
    <View style={{ position: 'absolute', top: 56, right: 64, height: 40, width: 2, backgroundColor: colors.primary, opacity: 0.8 }} />

    {/* Pin intermedio — morado */}
    <View style={{ position: 'absolute', top: 40, right: 48, height: 20, width: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: colors.text.primary }} />
    </View>

    {/* Pin de destino — indigo con sombra */}
    <View style={{ position: 'absolute', bottom: 48, right: 48, height: 28, width: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 12 }}>✈️</Text>
    </View>

    {/* Etiqueta del destino */}
    <View style={{ position: 'absolute', bottom: 24, right: 24, borderRadius: 8, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text.primary }}>Roma</Text>
    </View>
  </View>
)

// Documentos: boarding pass + pasaporte
const DocumentsIllustration = ({ colors }: { colors: any }) => (
  <View style={{ height: 208, width: 288, alignItems: 'center', justifyContent: 'center' }}>
    {/* Boarding pass — tarjeta horizontal */}
    <View
      style={{ position: 'absolute', top: 8, width: 256, borderRadius: 16, backgroundColor: colors.primary, padding: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 12, color: colors.text.secondary }}>SALIDA</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>MAD</Text>
        </View>
        <Text style={{ fontSize: 24 }}>✈️</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: colors.text.secondary }}>LLEGADA</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>FCO</Text>
        </View>
      </View>
      {/* Separador punteado */}
      <View style={{ marginVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={{ marginHorizontal: 2, height: 1, width: 8, backgroundColor: colors.text.secondary }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 12, color: colors.text.secondary }}>ASIENTO</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>12A</Text>
        </View>
        <View>
          <Text style={{ fontSize: 12, color: colors.text.secondary }}>CLASE</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>ECO</Text>
        </View>
        <View>
          <Text style={{ fontSize: 12, color: colors.text.secondary }}>EMBARQUE</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>14:30</Text>
        </View>
      </View>
    </View>

    {/* Pasaporte — sobre el boarding pass */}
    <View
      style={{ position: 'absolute', bottom: 0, right: 24, width: 112, borderRadius: 12, backgroundColor: colors.background.elevated, padding: 12 }}
    >
      <View style={{ marginBottom: 8, height: 8, width: '100%', borderRadius: 4, backgroundColor: colors.border }} />
      <View style={{ marginBottom: 4, height: 8, width: '75%', borderRadius: 4, backgroundColor: colors.border }} />
      <View style={{ marginBottom: 12, height: 8, width: '66%', borderRadius: 4, backgroundColor: colors.border }} />
      <View style={{ height: 32, width: '100%', borderRadius: 8, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: colors.text.secondary }}>📗 Pasaporte</Text>
      </View>
    </View>
  </View>
)

// Gráfico de barras de gastos por categoría
const BudgetIllustration = ({ colors }: { colors: any }) => {
  const BARS = [
    { label: 'Vuelo', height: 80, color: colors.primary },
    { label: 'Hotel', height: 110, color: colors.primary }, // TODO: verify color mapping - was purple
    { label: 'Comida', height: 60, color: colors.semantic.success },
    { label: 'Ocio', height: 45, color: colors.semantic.warning },
    { label: 'Otros', height: 35, color: colors.primary }, // TODO: verify color mapping - was blue
  ]

  return (
    <View style={{ height: 208, width: 288, alignItems: 'flex-end', justifyContent: 'flex-end', borderRadius: 24, backgroundColor: colors.background.surface, paddingHorizontal: 24, paddingBottom: 16 }}>
      {/* Líneas de cuadrícula */}
      <View style={{ position: 'absolute', top: 24, left: 24, right: 24, height: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 56, left: 24, right: 24, height: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 88, left: 24, right: 24, height: 1, backgroundColor: colors.border }} />
      <View style={{ position: 'absolute', top: 120, left: 24, right: 24, height: 1, backgroundColor: colors.border }} />

      {/* Barras */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        {BARS.map((bar) => (
          <View key={bar.label} style={{ alignItems: 'center', gap: 4 }}>
            <View
              style={{ width: 36, borderTopLeftRadius: 8, borderTopRightRadius: 8, height: bar.height, backgroundColor: bar.color, opacity: 0.9 }}
            />
            <Text style={{ fontSize: 12, color: colors.text.tertiary }}>{bar.label}</Text>
          </View>
        ))}
      </View>

      {/* Etiqueta de total */}
      <View style={{ position: 'absolute', top: 16, right: 24, borderRadius: 20, backgroundColor: colors.primary, opacity: 0.2, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>€ 1.240</Text>
      </View>
    </View>
  )
}

// ─── Configuración de los 3 slides ────────────────────────────────────────────

const SLIDES_DATA = [
  {
    title: 'Tu viaje, perfectamente organizado',
    subtitle: 'Genera itinerarios personalizados con IA en segundos',
  },
  {
    title: 'Todos tus documentos, siempre a mano',
    subtitle: 'Escanea y organiza tickets, reservas y pasaportes',
  },
  {
    title: 'Controla tu presupuesto sin esfuerzo',
    subtitle: 'Registra gastos por voz y convierte monedas al instante',
  },
]

// ─── Pantalla principal ───────────────────────────────────────────────────────

// Flujo: /(welcome)/onboarding → marca 'onboarding_shown' en AsyncStorage → /(auth)
export default function OnboardingScreen() {
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const { colors, spacing, typography } = useTheme()

  const SLIDES = [
    {
      illustration: <MapIllustration colors={colors} />,
      title: SLIDES_DATA[0].title,
      subtitle: SLIDES_DATA[0].subtitle,
    },
    {
      illustration: <DocumentsIllustration colors={colors} />,
      title: SLIDES_DATA[1].title,
      subtitle: SLIDES_DATA[1].subtitle,
    },
    {
      illustration: <BudgetIllustration colors={colors} />,
      title: SLIDES_DATA[2].title,
      subtitle: SLIDES_DATA[2].subtitle,
    },
  ]

  const isLastSlide = activeIndex === SLIDES.length - 1

  // Marca el onboarding como visto y navega al login
  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem('onboarding_shown', 'true')
    } catch (error) {
      logger.warn('No se pudo guardar el estado del onboarding', { error })
    }
    router.replace('/(auth)')
  }

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setActiveIndex(index)
  }

  const scrollToNext = () => {
    scrollRef.current?.scrollTo({ x: (activeIndex + 1) * SCREEN_WIDTH, animated: true })
  }

  return (
    <ScreenWrapper scroll={false} padding={false} backgroundColor={colors.background.base}>
      {/* Botón Saltar — solo en slides 1 y 2 */}
      <View style={{ position: 'absolute', right: 24, top: 56, zIndex: 10 }}>
        {!isLastSlide && (
          <Pressable
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel="Saltar introducción"
            hitSlop={12}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text.secondary }}>Saltar</Text>
          </Pressable>
        )}
      </View>

      {/* Slides con swipe horizontal */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, index) => (
          <OnboardingSlide
            key={index}
            illustration={slide.illustration}
            title={slide.title}
            subtitle={slide.subtitle}
            isActive={activeIndex === index}
          />
        ))}
      </ScrollView>

      {/* Footer: dots + botón */}
      <View style={{ alignItems: 'center', gap: 32, paddingBottom: 64, paddingTop: 24 }}>
        {/* Indicadores de posición (dots) */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SLIDES.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true })
              }}
              accessibilityLabel={`Ir al slide ${index + 1}`}
            >
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: activeIndex === index ? 24 : 8,
                  backgroundColor: activeIndex === index ? colors.primary : colors.text.tertiary,
                }}
              />
            </Pressable>
          ))}
        </View>

        {/* Botón de acción */}
        {isLastSlide ? (
          // Slide final — botón prominente "Empezar"
          <Button
            label="Empezar"
            variant="primary"
            onPress={handleFinish}
            style={{ width: 288 }}
          />
        ) : (
          // Slides 1 y 2 — botón "Siguiente" más sutil
          <Button
            label="Siguiente"
            variant="secondary"
            onPress={scrollToNext}
            style={{ width: 288 }}
          />
        )}
      </View>
    </ScreenWrapper>
  )
}
