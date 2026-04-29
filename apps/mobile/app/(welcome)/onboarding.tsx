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

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Ilustraciones inline con View primitives ────────────────────────────────

// Mapa estilizado con pins y ruta conectada
const MapIllustration = () => (
  <View className="h-52 w-72 items-center justify-center rounded-3xl bg-slate-800">
    {/* Fondo del mapa */}
    <View className="absolute inset-4 rounded-2xl bg-slate-700 overflow-hidden">
      {/* Líneas de calle horizontales */}
      <View className="absolute top-8 left-0 right-0 h-px bg-slate-600" />
      <View className="absolute top-16 left-0 right-0 h-px bg-slate-600" />
      <View className="absolute top-24 left-0 right-0 h-px bg-slate-600" />
      {/* Líneas de calle verticales */}
      <View className="absolute top-0 bottom-0 left-12 w-px bg-slate-600" />
      <View className="absolute top-0 bottom-0 left-28 w-px bg-slate-600" />
      <View className="absolute top-0 bottom-0 right-12 w-px bg-slate-600" />
    </View>

    {/* Pin de origen — verde */}
    <View className="absolute top-10 left-16 h-5 w-5 rounded-full bg-emerald-500 items-center justify-center">
      <View className="h-2 w-2 rounded-full bg-white" />
    </View>

    {/* Línea de ruta */}
    <View className="absolute top-14 left-20 h-0.5 w-20 bg-indigo-400" style={{ opacity: 0.8 }} />
    <View className="absolute top-14 right-16 h-10 w-0.5 bg-indigo-400" style={{ opacity: 0.8 }} />

    {/* Pin intermedio — morado */}
    <View className="absolute top-10 right-12 h-5 w-5 rounded-full bg-purple-500 items-center justify-center">
      <View className="h-2 w-2 rounded-full bg-white" />
    </View>

    {/* Pin de destino — indigo con sombra */}
    <View className="absolute bottom-12 right-12 h-7 w-7 rounded-full bg-indigo-500 items-center justify-center shadow-lg">
      <Text className="text-xs">✈️</Text>
    </View>

    {/* Etiqueta del destino */}
    <View className="absolute bottom-6 right-6 rounded-lg bg-indigo-600 px-2 py-0.5">
      <Text className="text-xs font-semibold text-white">Roma</Text>
    </View>
  </View>
)

// Documentos: boarding pass + pasaporte
const DocumentsIllustration = () => (
  <View className="h-52 w-72 items-center justify-center">
    {/* Boarding pass — tarjeta horizontal */}
    <View
      className="absolute top-2 w-64 rounded-2xl bg-indigo-600 p-4 shadow-lg"
      style={{ elevation: 6 }}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-indigo-300">SALIDA</Text>
          <Text className="text-lg font-bold text-white">MAD</Text>
        </View>
        <Text className="text-2xl">✈️</Text>
        <View className="items-end">
          <Text className="text-xs text-indigo-300">LLEGADA</Text>
          <Text className="text-lg font-bold text-white">FCO</Text>
        </View>
      </View>
      {/* Separador punteado */}
      <View className="my-3 flex-row items-center">
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} className="mx-0.5 h-px w-2 bg-indigo-400" />
        ))}
      </View>
      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-indigo-300">ASIENTO</Text>
          <Text className="text-sm font-bold text-white">12A</Text>
        </View>
        <View>
          <Text className="text-xs text-indigo-300">CLASE</Text>
          <Text className="text-sm font-bold text-white">ECO</Text>
        </View>
        <View>
          <Text className="text-xs text-indigo-300">EMBARQUE</Text>
          <Text className="text-sm font-bold text-white">14:30</Text>
        </View>
      </View>
    </View>

    {/* Pasaporte — sobre el boarding pass */}
    <View
      className="absolute bottom-0 right-6 w-28 rounded-xl bg-slate-700 p-3 shadow-xl"
      style={{ elevation: 10 }}
    >
      <View className="mb-2 h-2 w-full rounded-full bg-slate-500" />
      <View className="mb-1 h-2 w-3/4 rounded-full bg-slate-500" />
      <View className="mb-3 h-2 w-2/3 rounded-full bg-slate-500" />
      <View className="h-8 w-full rounded-lg bg-slate-600 items-center justify-center">
        <Text className="text-xs text-slate-400">📗 Pasaporte</Text>
      </View>
    </View>
  </View>
)

// Gráfico de barras de gastos por categoría
const BudgetIllustration = () => {
  const BARS = [
    { label: 'Vuelo', height: 80, color: '#6366F1' },
    { label: 'Hotel', height: 110, color: '#8B5CF6' },
    { label: 'Comida', height: 60, color: '#22C55E' },
    { label: 'Ocio', height: 45, color: '#F59E0B' },
    { label: 'Otros', height: 35, color: '#3B82F6' },
  ]

  return (
    <View className="h-52 w-72 items-end justify-end rounded-3xl bg-slate-800 px-6 pb-4">
      {/* Líneas de cuadrícula */}
      <View className="absolute top-6 left-6 right-6 h-px bg-slate-700" />
      <View className="absolute top-14 left-6 right-6 h-px bg-slate-700" />
      <View className="absolute top-22 left-6 right-6 h-px bg-slate-700" />
      <View className="absolute top-30 left-6 right-6 h-px bg-slate-700" />

      {/* Barras */}
      <View className="flex-row items-end gap-2.5">
        {BARS.map((bar) => (
          <View key={bar.label} className="items-center gap-1">
            <View
              className="w-9 rounded-t-lg"
              style={{ height: bar.height, backgroundColor: bar.color, opacity: 0.9 }}
            />
            <Text className="text-xs text-slate-500">{bar.label}</Text>
          </View>
        ))}
      </View>

      {/* Etiqueta de total */}
      <View className="absolute top-4 right-6 rounded-full bg-indigo-500/20 px-3 py-1">
        <Text className="text-xs font-bold text-indigo-400">€ 1.240</Text>
      </View>
    </View>
  )
}

// ─── Configuración de los 3 slides ────────────────────────────────────────────

const SLIDES = [
  {
    illustration: <MapIllustration />,
    title: 'Tu viaje, perfectamente organizado',
    subtitle: 'Genera itinerarios personalizados con IA en segundos',
  },
  {
    illustration: <DocumentsIllustration />,
    title: 'Todos tus documentos, siempre a mano',
    subtitle: 'Escanea y organiza tickets, reservas y pasaportes',
  },
  {
    illustration: <BudgetIllustration />,
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
    <View className="flex-1 bg-slate-900">
      {/* Botón Saltar — solo en slides 1 y 2 */}
      <View className="absolute right-6 top-14 z-10">
        {!isLastSlide && (
          <Pressable
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel="Saltar introducción"
            hitSlop={12}
          >
            <Text className="text-sm font-medium text-slate-400">Saltar</Text>
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
        className="flex-1"
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
      <View className="items-center gap-8 pb-16 pt-6">
        {/* Indicadores de posición (dots) */}
        <View className="flex-row gap-2">
          {SLIDES.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true })
              }}
              accessibilityLabel={`Ir al slide ${index + 1}`}
            >
              <View
                className={`h-2 rounded-full transition-all ${
                  activeIndex === index
                    ? 'w-6 bg-indigo-500'
                    : 'w-2 bg-slate-600'
                }`}
              />
            </Pressable>
          ))}
        </View>

        {/* Botón de acción */}
        {isLastSlide ? (
          // Slide final — botón prominente "Empezar"
          <Pressable
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel="Empezar a usar TravelApp"
            className="w-72 items-center rounded-2xl bg-indigo-500 py-4 active:bg-indigo-600"
          >
            <Text className="text-base font-bold text-white">Empezar</Text>
          </Pressable>
        ) : (
          // Slides 1 y 2 — botón "Siguiente" más sutil
          <Pressable
            onPress={scrollToNext}
            accessibilityRole="button"
            accessibilityLabel="Siguiente slide"
            className="w-72 items-center rounded-2xl border border-slate-700 py-4 active:bg-slate-800"
          >
            <Text className="text-base font-medium text-slate-300">Siguiente</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
