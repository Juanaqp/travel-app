import { useState, useRef, useEffect } from 'react'
import {
  View,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  StyleSheet,
  TextInput,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCreateTrip } from '@/hooks/useTrips'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { logger } from '@/lib/logger'
import type { TravelPace, BudgetTier, CreateTripInput } from '@travelapp/types'

// ─── Tipos internos del wizard ────────────────────────────────────────────────

interface WizardFormData {
  city: string
  country: string
  startDate: string
  endDate: string
  travelersCount: number
  budget: BudgetTier | null
  pace: TravelPace | null
  name: string
  baseCurrency: string
  budgetAmount: string  // solo visual — no está en CreateTripInput
}

const INITIAL_FORM: WizardFormData = {
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  travelersCount: 1,
  budget: null,
  pace: null,
  name: '',
  baseCurrency: 'USD',
  budgetAmount: '',
}

// Monedas disponibles para el selector
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'COP', 'ARS', 'BRL', 'JPY'] as const

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ─── Destinos sugeridos (lista estática) ─────────────────────────────────────

interface SuggestedDestination {
  city: string
  country: string
  emoji: string
  bg: string
}

const SUGGESTED_DESTINATIONS: SuggestedDestination[] = [
  { city: 'París', country: 'Francia', emoji: '🗼', bg: '#C17D46' },
  { city: 'Tokio', country: 'Japón', emoji: '⛩️', bg: '#C0392B' },
  { city: 'Nueva York', country: 'EE.UU.', emoji: '🗽', bg: '#2980B9' },
  { city: 'Roma', country: 'Italia', emoji: '🏛️', bg: '#8E6B3E' },
  { city: 'Bangkok', country: 'Tailandia', emoji: '🛕', bg: '#D4AC0D' },
  { city: 'Barcelona', country: 'España', emoji: '🏖️', bg: '#E74C3C' },
  { city: 'Bali', country: 'Indonesia', emoji: '🌴', bg: '#27AE60' },
  { city: 'Dubái', country: 'EAU', emoji: '🏙️', bg: '#8E44AD' },
]

// ─── Opciones de presupuesto y ritmo ─────────────────────────────────────────

const BUDGET_OPTIONS: { value: BudgetTier; label: string; description: string; emoji: string }[] = [
  { value: 'budget', label: 'Económico', description: 'Alojamiento y transporte asequibles', emoji: '💸' },
  { value: 'mid', label: 'Estándar', description: 'Buena relación calidad-precio', emoji: '💳' },
  { value: 'premium', label: 'Premium', description: 'Hoteles y experiencias de calidad', emoji: '⭐' },
  { value: 'luxury', label: 'Lujo', description: 'Sin límite — lo mejor de cada destino', emoji: '👑' },
]

const PACE_OPTIONS: { value: TravelPace; label: string; description: string; emoji: string }[] = [
  { value: 'slow', label: 'Tranquilo', description: 'Pocas actividades, descanso y disfrute', emoji: '🌿' },
  { value: 'moderate', label: 'Moderado', description: 'Un buen balance entre actividades y descanso', emoji: '🚶' },
  { value: 'intense', label: 'Intenso', description: 'Máximo aprovechamiento de cada día', emoji: '⚡' },
]

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface SelectOptionProps {
  label: string
  description?: string
  emoji: string
  isSelected: boolean
  onSelect: () => void
}

// Opción seleccionable estilo card — usada para budget y pace
const SelectOption = ({ label, description, emoji, isSelected, onSelect }: SelectOptionProps) => {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={[
        styles.selectOption,
        {
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: isSelected
            ? `${colors.primary}12`
            : colors.background.surface,
        },
      ]}
    >
      <Text style={styles.optionEmoji}>
        {emoji}
      </Text>
      <View style={styles.optionBody}>
        <Text
          variant="body"
          weight="semibold"
          color={isSelected ? colors.primary : colors.text.primary}
        >
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color={colors.text.secondary}>
            {description}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.radioCircle,
          {
            borderColor: isSelected ? colors.primary : colors.border,
            backgroundColor: isSelected ? colors.primary : 'transparent',
          },
        ]}
      >
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </Pressable>
  )
}

// ─── Tarjeta de fecha — reemplaza el Input plano ─────────────────────────────

interface DateCardProps {
  label: string
  sublabel: string
  value: string
  onChangeText: (v: string) => void
  error?: string
}

const DateCard = ({ label, sublabel, value, onChangeText, error }: DateCardProps) => {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const isActive = focused || value.length > 0

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.dateCard,
        {
          backgroundColor: colors.background.surface,
          borderColor: error
            ? colors.semantic.danger
            : isActive
            ? colors.primary
            : colors.border,
          borderWidth: isActive || error ? 1.5 : 1,
        },
      ]}
    >
      {/* Icono con fondo coral suave cuando activo */}
      <View
        style={[
          styles.dateCardIcon,
          {
            backgroundColor: isActive
              ? `${colors.primary}18`
              : colors.background.elevated,
          },
        ]}
      >
        <Icon
          name="calendar"
          size="md"
          color={isActive ? colors.primary : colors.text.tertiary}
        />
      </View>

      {/* Contenido: sublabel fijo + valor editable */}
      <View style={styles.dateCardContent}>
        <Text
          variant="caption"
          weight="medium"
          color={isActive ? colors.primary : colors.text.secondary}
        >
          {sublabel}
        </Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text.tertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          style={{
            color: colors.text.primary,
            fontSize: theme.typography.size.md,
            fontWeight: '600',
            marginTop: 2,
            padding: 0,
          }}
        />
        {error ? (
          <Text variant="caption" color={colors.semantic.danger} style={{ marginTop: 2 }}>
            {error}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

// ─── Indicador de paso ────────────────────────────────────────────────────────

interface StepIndicatorProps {
  step: number
  total: number
}

const StepIndicator = ({ step, total }: StepIndicatorProps) => {
  const { colors } = useTheme()
  // Anima el ancho de cada dot: active=24px, inactive=8px
  const dotWidths = useRef(
    Array.from({ length: total }, (_, i) => new Animated.Value(i === 0 ? 24 : 8))
  ).current

  useEffect(() => {
    Array.from({ length: total }, (_, i) => {
      Animated.timing(dotWidths[i]!, {
        toValue: i === step ? 24 : 8,
        duration: 200,
        useNativeDriver: false,
      }).start()
    })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              width: dotWidths[i],
              backgroundColor: i === step ? colors.primary : 'transparent',
              borderColor: i === step ? colors.primary : colors.border,
              borderWidth: 1.5,
            },
          ]}
        />
      ))}
    </View>
  )
}

// ─── Pasos del wizard ─────────────────────────────────────────────────────────

interface Step0Props {
  form: WizardFormData
  errors: Partial<Record<keyof WizardFormData, string>>
  onChange: (field: keyof WizardFormData, value: string) => void
  preselected?: string
}

// Paso 0 — Destino
const Step0Destination = ({ form, errors, onChange, preselected }: Step0Props) => {
  const { colors } = useTheme()
  return (
    <View>
      <Text variant="heading" weight="bold" color={colors.text.primary} style={styles.stepTitle}>
        ¿A dónde vas?
      </Text>
      <View style={styles.inputGroup}>
        <Input
          label="Ciudad"
          value={form.city}
          onChangeText={(v) => onChange('city', v)}
          placeholder="París, Tokio, Barcelona..."
          error={errors.city}
          icon="attraction"
        />
        <Input
          label="País"
          value={form.country}
          onChangeText={(v) => onChange('country', v)}
          placeholder="Francia, Japón, España..."
          error={errors.country}
          icon="explore"
        />
      </View>

      {/* Destinos sugeridos */}
      <Text
        variant="label"
        weight="semibold"
        color={colors.text.secondary}
        style={styles.suggestionsLabel}
      >
        Sugerencias populares
      </Text>
      <FlatList
        data={SUGGESTED_DESTINATIONS}
        keyExtractor={(item) => item.city}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionsContent}
        renderItem={({ item }) => {
          const isMatch =
            preselected?.toLowerCase() === item.city.toLowerCase() ||
            form.city.toLowerCase() === item.city.toLowerCase()
          return (
            <Pressable
              onPress={() => {
                onChange('city', item.city)
                onChange('country', item.country)
              }}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ${item.city}`}
              style={[
                styles.suggestionCard,
                {
                  backgroundColor: item.bg,
                  borderWidth: isMatch ? 2 : 0,
                  borderColor: isMatch ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text style={styles.suggestionEmoji}>{item.emoji}</Text>
              <Text
                variant="caption"
                weight="bold"
                color="#FFFFFF"
                numberOfLines={1}
              >
                {item.city}
              </Text>
              <Text
                variant="caption"
                color="rgba(255,255,255,0.75)"
                numberOfLines={1}
              >
                {item.country}
              </Text>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

interface Step1Props {
  form: WizardFormData
  errors: Partial<Record<keyof WizardFormData, string>>
  onChange: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void
}

// Calcula el número de días entre dos fechas ISO válidas
const calcDays = (start: string, end: string): number | null => {
  if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) return null
  const diff = Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / 864e5
  )
  return diff > 0 ? diff : null
}

// Paso 1 — Fechas y viajeros
const Step1Dates = ({ form, errors, onChange }: Step1Props) => {
  const { colors } = useTheme()
  const days = calcDays(form.startDate, form.endDate)

  return (
    <View>
      <Text variant="heading" weight="bold" color={colors.text.primary} style={styles.stepTitle}>
        ¿Cuándo viajas?
      </Text>

      {/* Tarjetas de fecha tapeables */}
      <View style={styles.dateCardsRow}>
        <View style={styles.dateCardWrapper}>
          <DateCard
            label="Fecha de salida"
            sublabel="Ida"
            value={form.startDate}
            onChangeText={(v) => onChange('startDate', v)}
            error={errors.startDate}
          />
        </View>
        <View style={styles.dateCardWrapper}>
          <DateCard
            label="Fecha de regreso"
            sublabel="Vuelta"
            value={form.endDate}
            onChangeText={(v) => onChange('endDate', v)}
            error={errors.endDate}
          />
        </View>
      </View>

      {/* Pill de días calculados */}
      {days !== null && (
        <View style={styles.daysPillContainer}>
          <View style={[styles.daysPill, { backgroundColor: `${colors.primary}18` }]}>
            <Icon name="calendar" size="sm" color={colors.primary} />
            <Text variant="body" weight="semibold" color={colors.primary}>
              {days} {days === 1 ? 'día' : 'días'}
            </Text>
          </View>
        </View>
      )}

      {/* Número de viajeros */}
      <View style={[styles.travelersCard, { backgroundColor: colors.background.surface, borderColor: colors.border }]}>
        <Text variant="label" weight="semibold" color={colors.text.secondary}>
          Número de viajeros
        </Text>
        <View style={styles.travelersRow}>
          <Pressable
            onPress={() => onChange('travelersCount', Math.max(1, form.travelersCount - 1))}
            accessibilityRole="button"
            accessibilityLabel="Reducir viajeros"
            disabled={form.travelersCount <= 1}
            style={[
              styles.travelersButton,
              { borderColor: colors.border, backgroundColor: colors.background.elevated },
            ]}
          >
            <Text variant="subheading" weight="bold" color={colors.text.primary}>−</Text>
          </Pressable>

          <Text
            variant="heading"
            weight="bold"
            color={colors.text.primary}
            style={styles.travelersCount}
          >
            {form.travelersCount}
          </Text>

          <Pressable
            onPress={() => onChange('travelersCount', Math.min(50, form.travelersCount + 1))}
            accessibilityRole="button"
            accessibilityLabel="Aumentar viajeros"
            style={[
              styles.travelersButton,
              { borderColor: colors.border, backgroundColor: colors.background.elevated },
            ]}
          >
            <Text variant="subheading" weight="bold" color={colors.text.primary}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

interface Step2Props {
  form: WizardFormData
  onChange: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void
}

// Paso 2 — Detalles (nombre, presupuesto, moneda, portada)
const Step2Details = ({ form, onChange }: Step2Props) => {
  const { colors, isDark } = useTheme()
  const [budgetFocused, setBudgetFocused] = useState(false)

  return (
    <View>
      <Text variant="heading" weight="bold" color={colors.text.primary} style={styles.stepTitle}>
        Personaliza tu viaje
      </Text>

      {/* Nombre del viaje */}
      <Input
        label="Nombre del viaje"
        value={form.name}
        onChangeText={(v) => onChange('name', v)}
        placeholder={`${form.city || 'Ciudad'}, ${form.country || 'País'}`}
        icon="explore"
      />

      {/* Presupuesto + moneda */}
      <Text
        variant="label"
        weight="semibold"
        color={colors.text.secondary}
        style={styles.sectionLabel}
      >
        Presupuesto del viaje
      </Text>

      {/* Input de cantidad */}
      <View
        style={[
          styles.budgetInputCard,
          {
            backgroundColor: colors.background.surface,
            borderColor: budgetFocused ? colors.primary : colors.border,
            borderWidth: budgetFocused ? 1.5 : 1,
          },
        ]}
      >
        <Text variant="subheading" weight="bold" color={colors.text.tertiary}>
          {form.baseCurrency}
        </Text>
        <TextInput
          value={form.budgetAmount}
          onChangeText={(v) => onChange('budgetAmount', v)}
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="decimal-pad"
          onFocus={() => setBudgetFocused(true)}
          onBlur={() => setBudgetFocused(false)}
          accessibilityLabel="Presupuesto total del viaje"
          style={{
            flex: 1,
            color: colors.text.primary,
            fontSize: theme.typography.size.xxl,
            fontWeight: '700',
            textAlign: 'center',
            padding: 0,
          }}
        />
      </View>

      {/* Selector de moneda — pills horizontales */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.currencyPillsContent}
        style={styles.currencyPillsRow}
      >
        {CURRENCIES.map((currency) => {
          const isActive = form.baseCurrency === currency
          return (
            <Pressable
              key={currency}
              onPress={() => onChange('baseCurrency', currency)}
              accessibilityRole="button"
              accessibilityLabel={`Moneda ${currency}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.currencyPill,
                {
                  backgroundColor: isActive ? colors.primary : colors.background.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                variant="caption"
                weight="semibold"
                color={isActive ? '#FFFFFF' : colors.text.secondary}
              >
                {currency}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Portada — tarjeta tappable con icono de cámara */}
      <Text
        variant="label"
        weight="semibold"
        color={colors.text.secondary}
        style={styles.sectionLabel}
      >
        Foto de portada (opcional)
      </Text>
      <Pressable
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel="Añadir foto de portada"
        style={[
          styles.coverPlaceholder,
          {
            backgroundColor: colors.background.surface,
            borderColor: colors.border,
            ...(isDark ? {} : theme.shadows.sm),
          },
        ]}
      >
        <View style={[styles.coverIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
          <Icon name="activity" size="xl" color={colors.primary} />
        </View>
        <Text variant="body" weight="semibold" color={colors.text.primary} style={styles.coverLabel}>
          Añadir foto de portada
        </Text>
        <Text variant="caption" color={colors.text.tertiary} align="center">
          Disponible próximamente
        </Text>
      </Pressable>
    </View>
  )
}

// ─── Pantalla principal del wizard ────────────────────────────────────────────

export default function NewTripScreen() {
  const { destination } = useLocalSearchParams<{ destination?: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardFormData>({
    ...INITIAL_FORM,
    city: destination ?? '',
    name: destination ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof WizardFormData, string>>>({})

  const { mutateAsync: createTrip, isPending } = useCreateTrip()

  const updateField = <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      // Auto-actualizar el nombre del viaje si coincide con el patrón generado
      if (
        (field === 'city' || field === 'country') &&
        (prev.name === `${prev.city}, ${prev.country}` || prev.name === prev.city || prev.name === '')
      ) {
        const newCity = field === 'city' ? String(value) : prev.city
        const newCountry = field === 'country' ? String(value) : prev.country
        updated.name = newCity && newCountry
          ? `${newCity}, ${newCountry}`
          : newCity || newCountry
      }
      return updated
    })
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // Valida campos del paso 0 (destino)
  const validateStep0 = (): boolean => {
    const newErrors: Partial<Record<keyof WizardFormData, string>> = {}
    if (!form.city.trim()) newErrors.city = 'La ciudad es obligatoria'
    if (!form.country.trim()) newErrors.country = 'El país es obligatorio'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Valida campos del paso 1 (fechas)
  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof WizardFormData, string>> = {}
    if (form.startDate && !DATE_REGEX.test(form.startDate))
      newErrors.startDate = 'Formato inválido (YYYY-MM-DD)'
    if (form.endDate && !DATE_REGEX.test(form.endDate))
      newErrors.endDate = 'Formato inválido (YYYY-MM-DD)'
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      newErrors.endDate = 'La fecha de regreso debe ser posterior a la salida'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    setStep((prev) => prev + 1)
  }

  const handleBack = () => {
    if (step === 0) {
      router.back()
    } else {
      setStep((prev) => prev - 1)
    }
  }

  const handleCreate = async () => {
    const input: CreateTripInput = {
      title: form.name.trim() || `${form.city}, ${form.country}`,
      destinations: [
        {
          city: form.city.trim(),
          country: form.country.trim(),
          arrivalDate: form.startDate || undefined,
          departureDate: form.endDate || undefined,
        },
      ],
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      travelersCount: form.travelersCount,
      budget: form.budget ?? undefined,
      pace: form.pace ?? undefined,
      baseCurrency: form.baseCurrency,
    }

    try {
      const trip = await createTrip(input)
      logger.info('Viaje creado desde el wizard', { tripId: trip.id })
      router.replace(`/(app)/trips/${trip.id}` as never)
    } catch (error) {
      logger.error('Error al crear viaje desde el wizard', { error })
    }
  }

  const STEP_CTA = ['Continuar →', 'Continuar →', 'Crear viaje']

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: colors.background.base }]}
    >
      {/* Header del wizard */}
      <View
        style={[
          styles.wizardHeader,
          {
            paddingTop: insets.top + theme.spacing.sm,
            borderBottomColor: colors.border,
            backgroundColor: colors.background.base,
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={styles.backButton}
        >
          <Icon name="back" size="lg" color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <StepIndicator step={step} total={3} />
        </View>

        {/* Espaciador para centrar los dots */}
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <Step0Destination
            form={form}
            errors={errors}
            onChange={updateField}
            preselected={destination}
          />
        )}
        {step === 1 && <Step1Dates form={form} errors={errors} onChange={updateField} />}
        {step === 2 && <Step2Details form={form} onChange={updateField} />}

        {/* CTA del paso */}
        <View style={styles.ctaContainer}>
          <Button
            label={step < 2 ? STEP_CTA[step]! : isPending ? 'Creando viaje...' : STEP_CTA[2]!}
            onPress={step < 2 ? handleNext : handleCreate}
            variant="primary"
            fullWidth
            loading={isPending}
            disabled={isPending}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: theme.radius.full,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  stepTitle: {
    marginBottom: theme.spacing.lg,
  },
  inputGroup: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  // ─── DateCard ───────────────────────────────────────────────────────────────
  dateCardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  dateCardWrapper: {
    flex: 1,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  dateCardIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardContent: {
    flex: 1,
  },
  // ─── Budget + currency ───────────────────────────────────────────────────────
  budgetInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    minHeight: 72,
  },
  currencyPillsRow: {
    marginTop: theme.spacing.sm,
  },
  currencyPillsContent: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  currencyPill: {
    height: 34,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ─── Cover ──────────────────────────────────────────────────────────────────
  coverIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  suggestionsLabel: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  suggestionsContent: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  suggestionCard: {
    width: 140,
    height: 100,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  suggestionEmoji: {
    fontSize: 28,
    marginBottom: theme.spacing.xs,
  },
  daysPillContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  daysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
  },
  travelersCard: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  travelersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  travelersButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelersCount: {
    minWidth: 40,
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  optionsGroup: {
    gap: theme.spacing.sm,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  optionEmoji: {
    fontSize: 22,
    width: 28,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coverPlaceholder: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  coverLabel: {
    marginTop: theme.spacing.xs,
  },
  ctaContainer: {
    marginTop: theme.spacing.xl,
  },
})
