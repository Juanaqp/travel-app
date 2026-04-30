import { useState, useRef, useEffect } from 'react'
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTrip } from '@/hooks/useTrips'
import { useGenerateItinerary } from '@/hooks/useGenerateItinerary'
import { useItineraryStore } from '@/stores/useItineraryStore'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import type { ItineraryStyle } from '@/hooks/useGenerateItinerary'
import type { TravelPace, BudgetTier } from '@travelapp/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const PACE_OPTIONS: { value: TravelPace; label: string }[] = [
  { value: 'slow', label: 'Tranquilo' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'intense', label: 'Intenso' },
]

const BUDGET_OPTIONS: { value: BudgetTier; label: string }[] = [
  { value: 'budget', label: 'Económico' },
  { value: 'mid', label: 'Estándar' },
  { value: 'premium', label: 'Premium' },
]

// ─── Control segmentado reutilizable ─────────────────────────────────────────

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  selected: T
  onSelect: (value: T) => void
}

function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme()

  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: colors.background.surface, borderColor: colors.border },
      ]}
    >
      {options.map((opt) => {
        const isActive = opt.value === selected
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            style={[
              styles.segment,
              isActive && {
                backgroundColor: colors.background.base,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
              },
            ]}
          >
            <Text
              variant="caption"
              weight={isActive ? 'semibold' : 'regular'}
              color={isActive ? colors.text.primary : colors.text.tertiary}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Tarjeta de estilo ────────────────────────────────────────────────────────

interface StyleCardProps {
  emoji: string
  label: string
  isSelected: boolean
  onPress: () => void
}

const StyleCard = ({ emoji, label, isSelected, onPress }: StyleCardProps) => {
  const { colors } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`Estilo ${label}`}
      accessibilityState={{ checked: isSelected }}
      style={[
        styles.styleCard,
        {
          backgroundColor: isSelected ? colors.primary : colors.background.surface,
          borderColor: isSelected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={styles.styleEmoji}>{emoji}</Text>
      <Text
        variant="caption"
        weight="semibold"
        color={isSelected ? '#FFFFFF' : colors.text.secondary}
        align="center"
      >
        {label}
      </Text>
    </Pressable>
  )
}

// ─── Vista de carga ───────────────────────────────────────────────────────────

interface LoadingViewProps {
  messageIndex: number
  messageFade: Animated.Value
  spinAnim: Animated.Value
}

const LoadingView = ({ messageIndex, messageFade, spinAnim }: LoadingViewProps) => {
  const { colors } = useTheme()

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background.base }]}>
      {/* Spinner coral animado */}
      <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
        <View
          style={[
            styles.spinner,
            { borderColor: `${colors.primary}30`, borderTopColor: colors.primary },
          ]}
        />
      </Animated.View>

      <Text
        variant="heading"
        weight="bold"
        color={colors.text.primary}
        align="center"
        style={styles.loadingTitle}
      >
        Creando tu itinerario...
      </Text>
      <Text variant="body" color={colors.text.secondary} align="center">
        Esto puede tardar entre 10 y 20 segundos
      </Text>

      {/* Mensaje rotativo con fade */}
      <Animated.View style={[styles.messageWrapper, { opacity: messageFade }]}>
        <Text variant="label" color={colors.text.tertiary} align="center">
          {LOADING_MESSAGES[messageIndex]}
        </Text>
      </Animated.View>
    </View>
  )
}

// ─── Vista de éxito ───────────────────────────────────────────────────────────

interface SuccessViewProps {
  tripId: string
  totalDays: number
  totalNodes: number
}

const SuccessView = ({ tripId, totalDays, totalNodes }: SuccessViewProps) => {
  const { colors } = useTheme()

  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background.base }]}>
      <View style={[styles.successIcon, { backgroundColor: `${colors.semantic.success}18` }]}>
        <Text style={{ fontSize: 36 }}>✅</Text>
      </View>

      <Text variant="heading" weight="bold" color={colors.text.primary} align="center">
        ¡Tu itinerario está listo!
      </Text>
      <Text variant="body" color={colors.text.secondary} align="center">
        {totalDays} días · {totalNodes} actividades planificadas
      </Text>
      <Text variant="caption" color={colors.text.tertiary} align="center" style={styles.successNote}>
        El itinerario se guardará cuando lo confirmes
      </Text>

      <View style={styles.successActions}>
        <Button
          label="Ver itinerario"
          onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/review` as never)}
          variant="primary"
        />
        <Button
          label="Volver al viaje"
          onPress={() => router.push(`/(app)/trips/${tripId}` as never)}
          variant="secondary"
        />
      </View>
    </View>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function GenerateItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { data: trip, isLoading: isTripLoading } = useTrip(id ?? '')
  const { generate, status, error, reset } = useGenerateItinerary()
  const { colors } = useTheme()

  const draftGraph = useItineraryStore((s) => s.draftGraph)

  const [userRequest, setUserRequest] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<ItineraryStyle | null>(null)
  const [selectedPace, setSelectedPace] = useState<TravelPace>('moderate')
  const [selectedBudget, setSelectedBudget] = useState<BudgetTier>('mid')
  const [restrictions, setRestrictions] = useState('')

  // Animaciones de carga
  const spinAnim = useRef(new Animated.Value(0)).current
  const messageFade = useRef(new Animated.Value(1)).current
  const [messageIndex, setMessageIndex] = useState(0)

  // Sincroniza pace/budget con datos del viaje cuando cargan
  useEffect(() => {
    if (trip) {
      if (trip.pace) setSelectedPace(trip.pace as TravelPace)
      if (trip.budget) setSelectedBudget(trip.budget as BudgetTier)
    }
  }, [trip?.id])

  // Spinner rotativo durante la carga
  useEffect(() => {
    if (status === 'loading') {
      const spin = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      )
      spin.start()
      return () => spin.stop()
    } else {
      spinAnim.setValue(0)
    }
  }, [status])

  // Mensajes ciclados con fade cada 2.5s
  useEffect(() => {
    if (status !== 'loading') {
      setMessageIndex(0)
      return
    }
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(messageFade, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(messageFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start()
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [status])

  const hasDates = !!(trip?.startDate && trip?.endDate)
  const isFormValid = !!selectedStyle && userRequest.trim().length >= 10 && hasDates

  const handleGenerate = async () => {
    if (!trip || !selectedStyle || !hasDates) return

    const destination = trip.destinations[0]
      ? `${trip.destinations[0].city}, ${trip.destinations[0].country}`
      : trip.title

    const fullRequest = `${destination} — ${userRequest.trim()}`

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
      pace: selectedPace,
      budget: selectedBudget,
      avoid: avoidList.length ? avoidList : undefined,
    })
  }

  // ─── Estados tempranos ────────────────────────────────────────────────────

  if (isTripLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.base }]}>
        <Text variant="body" color={colors.text.tertiary}>Cargando datos del viaje...</Text>
      </View>
    )
  }

  if (!trip) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.base }]}>
        <Icon name="offline" size="xl" color={colors.text.tertiary} />
        <Text variant="subheading" weight="semibold" color={colors.text.secondary} align="center">
          Viaje no encontrado
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text variant="label" color={colors.primary}>← Volver</Text>
        </Pressable>
      </View>
    )
  }

  if (status === 'loading') {
    return (
      <LoadingView
        messageIndex={messageIndex}
        messageFade={messageFade}
        spinAnim={spinAnim}
      />
    )
  }

  if (status === 'success') {
    return (
      <SuccessView
        tripId={trip.id}
        totalDays={draftGraph?.meta?.totalDays ?? 0}
        totalNodes={draftGraph?.meta?.totalNodes ?? 0}
      />
    )
  }

  const primaryDestination = trip.destinations[0]
    ? `${trip.destinations[0].city}, ${trip.destinations[0].country}`
    : trip.title

  // ─── Formulario principal ─────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: colors.background.base }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            backgroundColor: colors.background.base,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
          style={styles.backBtn}
        >
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.text.tertiary}>
            Generador de itinerario
          </Text>
          <Text variant="label" weight="semibold" color={colors.text.primary} numberOfLines={1}>
            {primaryDestination}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Alerta sin fechas */}
        {!hasDates ? (
          <View
            style={[
              styles.alertCard,
              { backgroundColor: `${colors.semantic.warning}12`, borderColor: `${colors.semantic.warning}30` },
            ]}
          >
            <Text variant="label" weight="semibold" color={colors.semantic.warning}>
              ⚠️ El viaje no tiene fechas configuradas
            </Text>
            <Text variant="caption" color={colors.semantic.warning} style={{ marginTop: 4, opacity: 0.8 }}>
              Vuelve al viaje y añade las fechas antes de generar el itinerario.
            </Text>
          </View>
        ) : null}

        {/* Descripción */}
        <View style={[styles.card, { backgroundColor: colors.background.surface, borderColor: colors.border }]}>
          <Text variant="subheading" weight="bold" color={colors.text.primary}>
            ¿Qué tipo de viaje quieres?
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.cardSubtitle}>
            Describe experiencias, intereses o lugares que quieras visitar
          </Text>

          <View
            style={[
              styles.textAreaWrapper,
              { backgroundColor: colors.background.base, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={userRequest}
              onChangeText={setUserRequest}
              placeholder="Ej: Quiero ver los museos más icónicos, probar comida local auténtica..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              maxLength={450}
              accessibilityLabel="Descripción del viaje ideal"
              style={[styles.textArea, { color: colors.text.primary }]}
            />
            <Text variant="caption" color={colors.text.tertiary} style={styles.charCount}>
              {userRequest.length}/450
            </Text>
          </View>
        </View>

        {/* Estilo de viaje (scroll horizontal) */}
        <View style={styles.section}>
          <Text variant="label" weight="semibold" color={colors.text.primary} style={styles.sectionLabel}>
            Estilo de viaje
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.styleCardsContent}
          >
            {STYLE_OPTIONS.map((opt) => (
              <StyleCard
                key={opt.value}
                emoji={opt.emoji}
                label={opt.label}
                isSelected={selectedStyle === opt.value}
                onPress={() => setSelectedStyle(opt.value)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Ritmo de viaje */}
        <View style={styles.section}>
          <Text variant="label" weight="semibold" color={colors.text.primary} style={styles.sectionLabel}>
            Ritmo del viaje
          </Text>
          <SegmentedControl
            options={PACE_OPTIONS}
            selected={selectedPace}
            onSelect={setSelectedPace}
          />
        </View>

        {/* Nivel de presupuesto */}
        <View style={styles.section}>
          <Text variant="label" weight="semibold" color={colors.text.primary} style={styles.sectionLabel}>
            Nivel de presupuesto
          </Text>
          <SegmentedControl
            options={BUDGET_OPTIONS}
            selected={selectedBudget}
            onSelect={setSelectedBudget}
          />
        </View>

        {/* Restricciones opcionales */}
        <View style={styles.section}>
          <Text variant="label" weight="semibold" color={colors.text.primary} style={styles.sectionLabel}>
            ¿Algo que prefieras evitar?{' '}
            <Text variant="caption" color={colors.text.tertiary}>(opcional)</Text>
          </Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.background.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={restrictions}
              onChangeText={setRestrictions}
              placeholder="Ej: no museos, sin subidas, evitar zonas turísticas..."
              placeholderTextColor={colors.text.tertiary}
              maxLength={200}
              accessibilityLabel="Restricciones o preferencias a evitar"
              style={[styles.input, { color: colors.text.primary }]}
            />
          </View>
        </View>

        {/* Error de generación */}
        {status === 'error' && error ? (
          <View
            style={[
              styles.alertCard,
              { backgroundColor: `${colors.semantic.danger}10`, borderColor: `${colors.semantic.danger}30` },
            ]}
          >
            <Text variant="label" weight="semibold" color={colors.semantic.danger}>
              ❌ Error al generar
            </Text>
            <Text variant="caption" color={colors.semantic.danger} style={{ marginTop: 4, opacity: 0.8 }}>
              {error}
            </Text>
            <Pressable onPress={reset} accessibilityRole="button" style={styles.retryLink}>
              <Text variant="caption" weight="semibold" color={colors.primary}>
                Intentar de nuevo →
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Resumen del viaje */}
        <View
          style={[
            styles.contextCard,
            { backgroundColor: colors.background.surface, borderColor: colors.border },
          ]}
        >
          <Text
            variant="caption"
            weight="semibold"
            color={colors.text.tertiary}
            style={styles.contextLabel}
          >
            CONTEXTO DEL VIAJE
          </Text>
          <View style={styles.contextItems}>
            {trip.startDate && trip.endDate ? (
              <Text variant="caption" color={colors.text.secondary}>
                📅 {trip.startDate} → {trip.endDate}
              </Text>
            ) : null}
            <Text variant="caption" color={colors.text.secondary}>
              👤 {trip.travelersCount} {trip.travelersCount === 1 ? 'viajero' : 'viajeros'}
            </Text>
          </View>
        </View>

        {/* Botón generar */}
        <Button
          label="✨ Generar itinerario"
          onPress={handleGenerate}
          variant="primary"
          disabled={!isFormValid}
        />

        {!isFormValid && !error ? (
          <Text
            variant="caption"
            color={colors.text.tertiary}
            align="center"
            style={styles.validationHint}
          >
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

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  alertCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  card: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cardSubtitle: {
    marginBottom: theme.spacing.sm,
  },
  textAreaWrapper: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  textArea: {
    fontSize: theme.typography.size.base,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    marginBottom: 2,
  },
  styleCardsContent: {
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
  styleCard: {
    width: 100,
    height: 120,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  styleEmoji: {
    fontSize: 36,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  inputWrapper: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  input: {
    fontSize: theme.typography.size.base,
    height: 44,
  },
  retryLink: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  contextCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  contextLabel: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  contextItems: {
    gap: theme.spacing.xs,
  },
  validationHint: {
    marginTop: theme.spacing.sm,
  },
  // Loading / Success
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  spinner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
  },
  loadingTitle: {
    marginTop: theme.spacing.sm,
  },
  messageWrapper: {
    marginTop: theme.spacing.sm,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  successNote: {
    marginBottom: theme.spacing.lg,
  },
  successActions: {
    width: '100%',
    gap: theme.spacing.sm,
  },
})
