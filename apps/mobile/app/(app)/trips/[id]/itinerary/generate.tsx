import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useTrip } from '@/hooks/useTrips'
import { useGenerateItinerary } from '@/hooks/useGenerateItinerary'
import { useItineraryStore } from '@/stores/useItineraryStore'
import { Button } from '@/components/Button'
import type { ItineraryStyle } from '@/hooks/useGenerateItinerary'
import type { TravelPace, BudgetTier } from '@travelapp/types'

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Explorando los mejores lugares...',
  'Calculando rutas óptimas...',
  'Añadiendo recomendaciones locales...',
  'Casi listo...',
] as const

const STYLE_OPTIONS: { value: ItineraryStyle; label: string; emoji: string }[] = [
  { value: 'cultural', label: 'Cultura', emoji: '🏛️' },
  { value: 'gastronomy', label: 'Gastronomía', emoji: '🍽️' },
  { value: 'adventure', label: 'Aventura', emoji: '🧗' },
  { value: 'relax', label: 'Relax', emoji: '🌿' },
]

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface StyleChipProps {
  emoji: string
  label: string
  isSelected: boolean
  onPress: () => void
}

const StyleChip = ({ emoji, label, isSelected, onPress }: StyleChipProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={`Estilo ${label}`}
    accessibilityState={{ checked: isSelected }}
    className={`flex-1 items-center rounded-xl border py-3 active:opacity-80 ${
      isSelected
        ? 'border-indigo-500 bg-indigo-950'
        : 'border-slate-700 bg-slate-800'
    }`}
  >
    <Text className="text-xl" accessibilityElementsHidden>
      {emoji}
    </Text>
    <Text
      className={`mt-1 text-xs font-semibold ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}
    >
      {label}
    </Text>
  </Pressable>
)

// ─── Estado de carga ──────────────────────────────────────────────────────────

interface LoadingViewProps {
  progressAnim: Animated.Value
  messageIndex: number
}

const LoadingView = ({ progressAnim, messageIndex }: LoadingViewProps) => {
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="mb-2 text-6xl" accessibilityElementsHidden>
        🗺️
      </Text>
      <Text className="mb-2 text-xl font-bold text-white">
        Creando tu itinerario...
      </Text>
      <Text className="mb-8 text-sm text-slate-400">
        Esto puede tardar entre 10 y 20 segundos
      </Text>

      {/* Barra de progreso animada */}
      <View className="mb-6 w-full overflow-hidden rounded-full bg-slate-700" style={{ height: 6 }}>
        <Animated.View
          className="rounded-full bg-indigo-500"
          style={{ height: 6, width: progressWidth }}
        />
      </View>

      {/* Mensaje rotativo */}
      <Text className="text-center text-sm text-slate-400">
        {LOADING_MESSAGES[messageIndex]}
      </Text>
    </View>
  )
}

// ─── Estado de éxito ──────────────────────────────────────────────────────────

interface SuccessViewProps {
  tripId: string
  totalDays: number
  totalNodes: number
}

const SuccessView = ({ tripId, totalDays, totalNodes }: SuccessViewProps) => (
  <View className="flex-1 items-center justify-center px-8">
    <Text className="mb-4 text-6xl" accessibilityElementsHidden>
      ✅
    </Text>
    <Text className="mb-2 text-xl font-bold text-white">
      ¡Tu itinerario está listo!
    </Text>
    <Text className="mb-2 text-center text-sm text-slate-400">
      {totalDays} días · {totalNodes} actividades planificadas
    </Text>
    <Text className="mb-10 text-center text-xs text-slate-500">
      El itinerario se guardará cuando lo confirmes
    </Text>

    <View className="w-full gap-3">
      <Button
        label="Ver itinerario"
        onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/review` as never)}
        variant="primary"
        accessibilityLabel="Ver el itinerario generado"
      />
      <Button
        label="Volver al viaje"
        onPress={() => router.push(`/(app)/trips/${tripId}` as never)}
        variant="secondary"
        accessibilityLabel="Volver a la pantalla del viaje"
      />
    </View>
  </View>
)

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function GenerateItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: trip, isLoading: isTripLoading } = useTrip(id ?? '')
  const { generate, status, error, reset } = useGenerateItinerary()

  const draftGraph = useItineraryStore((s) => s.draftGraph)

  const [userRequest, setUserRequest] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<ItineraryStyle | null>(null)
  const [restrictions, setRestrictions] = useState('')

  // Animación de progreso
  const progressAnim = useRef(new Animated.Value(0)).current
  const [messageIndex, setMessageIndex] = useState(0)

  // Cicla los mensajes de carga cada 3 segundos
  useEffect(() => {
    if (status !== 'loading') return
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [status])

  // Anima la barra de progreso según el estado
  useEffect(() => {
    if (status === 'loading') {
      progressAnim.setValue(0)
      Animated.timing(progressAnim, {
        toValue: 85,
        duration: 15000,
        useNativeDriver: false,
      }).start()
    } else if (status === 'success') {
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 400,
        useNativeDriver: false,
      }).start()
    } else {
      progressAnim.setValue(0)
      setMessageIndex(0)
    }
  }, [status, progressAnim])

  // Valida que los campos requeridos estén completos
  const hasDates = !!(trip?.startDate && trip?.endDate)
  const isFormValid =
    !!selectedStyle && userRequest.trim().length >= 10 && hasDates

  const handleGenerate = async () => {
    if (!trip || !selectedStyle || !hasDates) return

    const destination =
      trip.destinations[0]
        ? `${trip.destinations[0].city}, ${trip.destinations[0].country}`
        : trip.title

    // Construye el request completo combinando destino + descripción del usuario
    const fullRequest = `${destination} — ${userRequest.trim()}`

    // Parsea restricciones separadas por coma
    const avoidList = restrictions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    await generate({
      tripId: trip.id,
      userRequest: fullRequest,
      style: selectedStyle,
      dates: { start: trip.startDate!, end: trip.endDate! },
      travelers: trip.travelersCount,
      pace: (trip.pace ?? 'moderate') as TravelPace,
      budget: (trip.budget ?? 'mid') as BudgetTier,
      avoid: avoidList.length ? avoidList : undefined,
    })
  }

  // Estado: cargando datos del viaje
  if (isTripLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-slate-400">Cargando datos del viaje...</Text>
      </View>
    )
  }

  // Estado: viaje no encontrado
  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="mb-4 text-4xl">😕</Text>
        <Text className="mb-2 text-lg font-bold text-white">Viaje no encontrado</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text className="text-indigo-400">← Volver</Text>
        </Pressable>
      </View>
    )
  }

  // Estado: generando (mostrar animación)
  if (status === 'loading') {
    return (
      <View className="flex-1 bg-slate-900">
        <LoadingView progressAnim={progressAnim} messageIndex={messageIndex} />
      </View>
    )
  }

  // Estado: generación exitosa
  if (status === 'success') {
    const totalDays = draftGraph?.meta?.totalDays ?? 0
    const totalNodes = draftGraph?.meta?.totalNodes ?? 0

    return (
      <View className="flex-1 bg-slate-900">
        <SuccessView
          tripId={trip.id}
          totalDays={totalDays}
          totalNodes={totalNodes}
        />
      </View>
    )
  }

  // Destino del viaje para mostrar en el contexto
  const primaryDestination =
    trip.destinations[0]
      ? `${trip.destinations[0].city}, ${trip.destinations[0].country}`
      : trip.title

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      {/* Header */}
      <View className="flex-row items-center border-b border-slate-700 px-4 pb-4 pt-12">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
          className="mr-3 rounded-lg p-1 active:bg-slate-800"
        >
          <Text className="text-2xl text-slate-400">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xs text-slate-500">Generador de itinerario</Text>
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {primaryDestination}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Alerta si no hay fechas */}
        {!hasDates ? (
          <View className="mb-5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3">
            <Text className="text-sm font-semibold text-amber-400">
              ⚠️ El viaje no tiene fechas configuradas
            </Text>
            <Text className="mt-1 text-xs text-amber-500/80">
              Vuelve al viaje y añade las fechas antes de generar el itinerario.
            </Text>
          </View>
        ) : null}

        {/* Campo principal de descripción */}
        <Text className="mb-2 text-xl font-bold text-white">
          ¿Qué tipo de viaje quieres?
        </Text>
        <Text className="mb-4 text-sm text-slate-400">
          Describe experiencias, intereses o lugares que quieras visitar
        </Text>

        <View className="mb-6 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
          <TextInput
            value={userRequest}
            onChangeText={setUserRequest}
            placeholder="Ej: Quiero ver los museos más icónicos, probar comida local auténtica..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
            maxLength={450}
            accessibilityLabel="Descripción del viaje ideal"
            style={{ color: '#f1f5f9', fontSize: 15, minHeight: 100, textAlignVertical: 'top' }}
          />
          <Text className="mt-2 text-right text-xs text-slate-600">
            {userRequest.length}/450
          </Text>
        </View>

        {/* Selector de estilo */}
        <Text className="mb-3 text-sm font-semibold text-slate-300">
          Estilo de viaje
        </Text>

        <View className="mb-2 flex-row gap-2">
          {STYLE_OPTIONS.slice(0, 2).map((opt) => (
            <StyleChip
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              isSelected={selectedStyle === opt.value}
              onPress={() => setSelectedStyle(opt.value)}
            />
          ))}
        </View>
        <View className="mb-6 flex-row gap-2">
          {STYLE_OPTIONS.slice(2, 4).map((opt) => (
            <StyleChip
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              isSelected={selectedStyle === opt.value}
              onPress={() => setSelectedStyle(opt.value)}
            />
          ))}
        </View>

        {/* Campo de restricciones (opcional) */}
        <Text className="mb-2 text-sm font-semibold text-slate-300">
          ¿Algo que prefieras evitar?{' '}
          <Text className="font-normal text-slate-500">(opcional)</Text>
        </Text>
        <View className="mb-8 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
          <TextInput
            value={restrictions}
            onChangeText={setRestrictions}
            placeholder="Ej: no museos, sin subidas, evitar zonas turísticas..."
            placeholderTextColor="#64748b"
            maxLength={200}
            accessibilityLabel="Restricciones o preferencias a evitar"
            style={{ color: '#f1f5f9', fontSize: 14 }}
          />
        </View>

        {/* Error de generación */}
        {status === 'error' && error ? (
          <View className="mb-6 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3">
            <Text className="text-sm font-semibold text-red-400">
              ❌ Error al generar
            </Text>
            <Text className="mt-1 text-xs text-red-400/80">{error}</Text>
            <Pressable
              onPress={reset}
              accessibilityRole="button"
              className="mt-3 self-start"
            >
              <Text className="text-xs font-semibold text-indigo-400">
                Intentar de nuevo →
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Contexto del viaje (resumen) */}
        <View className="mb-6 rounded-xl bg-slate-800/50 px-4 py-3">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Contexto del viaje
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {trip.startDate && trip.endDate ? (
              <Text className="text-xs text-slate-400">
                📅 {trip.startDate} → {trip.endDate}
              </Text>
            ) : null}
            <Text className="text-xs text-slate-400">
              👤 {trip.travelersCount} {trip.travelersCount === 1 ? 'viajero' : 'viajeros'}
            </Text>
            {trip.pace ? (
              <Text className="text-xs text-slate-400">
                🚶{' '}
                {{ slow: 'Tranquilo', moderate: 'Moderado', intense: 'Intenso' }[trip.pace]}
              </Text>
            ) : null}
            {trip.budget ? (
              <Text className="text-xs text-slate-400">
                💳{' '}
                {{ budget: 'Económico', mid: 'Estándar', premium: 'Premium', luxury: 'Lujo' }[trip.budget]}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Botón de generación */}
        <Button
          label="✨ Generar itinerario"
          onPress={handleGenerate}
          variant="primary"
          isDisabled={!isFormValid}
          accessibilityLabel="Generar itinerario con inteligencia artificial"
        />

        {!isFormValid && !error ? (
          <Text className="mt-3 text-center text-xs text-slate-500">
            {!hasDates
              ? 'Añade fechas al viaje para continuar'
              : !selectedStyle
              ? 'Selecciona un estilo de viaje'
              : 'Describe tu viaje ideal (mínimo 10 caracteres)'}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
