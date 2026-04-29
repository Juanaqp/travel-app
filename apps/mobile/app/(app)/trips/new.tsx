import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCreateTrip } from '@/hooks/useTrips'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { logger } from '@/lib/logger'
import type { TravelPace, BudgetTier, CreateTripInput } from '@travelapp/types'

// ─── Tipos internos del wizard ────────────────────────────────────────────────

interface WizardFormData {
  // Paso 1 — destino y fechas
  city: string
  country: string
  startDate: string
  endDate: string
  // Paso 2 — viajeros y presupuesto
  travelersCount: number
  budget: BudgetTier | null
  // Paso 3 — estilo de viaje
  pace: TravelPace | null
}

const INITIAL_FORM: WizardFormData = {
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  travelersCount: 1,
  budget: null,
  pace: null,
}

// ─── Sub-componentes del wizard ───────────────────────────────────────────────

interface StepIndicatorProps {
  current: number
  total: number
}

const StepIndicator = ({ current, total }: StepIndicatorProps) => (
  <View className="flex-row items-center justify-center gap-2 py-4">
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        className={`h-2 rounded-full ${
          i < current ? 'w-8 bg-indigo-500' : i === current ? 'w-8 bg-indigo-400' : 'w-4 bg-slate-600'
        }`}
      />
    ))}
  </View>
)

interface SelectOptionProps {
  label: string
  description?: string
  emoji: string
  isSelected: boolean
  onSelect: () => void
  accessibilityLabel: string
}

// Botón de opción seleccionable estilo card
const SelectOption = ({
  label,
  description,
  emoji,
  isSelected,
  onSelect,
  accessibilityLabel,
}: SelectOptionProps) => (
  <Pressable
    onPress={onSelect}
    accessibilityRole="radio"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ checked: isSelected }}
    className={`mb-3 flex-row items-center rounded-xl border p-4 ${
      isSelected ? 'border-indigo-500 bg-indigo-950' : 'border-slate-700 bg-slate-800'
    }`}
  >
    <Text className="mr-3 text-2xl" accessibilityElementsHidden>
      {emoji}
    </Text>
    <View className="flex-1">
      <Text className={`font-semibold ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
        {label}
      </Text>
      {description ? (
        <Text className="mt-0.5 text-xs text-slate-400">{description}</Text>
      ) : null}
    </View>
    {isSelected ? (
      <View className="h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
        <Text className="text-xs font-bold text-white">✓</Text>
      </View>
    ) : (
      <View className="h-5 w-5 rounded-full border-2 border-slate-600" />
    )}
  </Pressable>
)

// ─── Pasos del wizard ─────────────────────────────────────────────────────────

interface Step1Props {
  form: WizardFormData
  errors: Partial<Record<keyof WizardFormData, string>>
  onChange: (field: keyof WizardFormData, value: string) => void
}

const Step1Destination = ({ form, errors, onChange }: Step1Props) => (
  <View>
    <Text className="mb-6 text-xl font-bold text-white">¿A dónde vas?</Text>

    <View className="gap-4">
      <Input
        label="Ciudad"
        value={form.city}
        onChangeText={(v) => onChange('city', v)}
        placeholder="Paris, Tokio, Barcelona..."
        error={errors.city}
        accessibilityLabel="Ciudad de destino"
      />
      <Input
        label="País"
        value={form.country}
        onChangeText={(v) => onChange('country', v)}
        placeholder="Francia, Japón, España..."
        error={errors.country}
        accessibilityLabel="País de destino"
      />
      <Input
        label="Fecha de inicio"
        value={form.startDate}
        onChangeText={(v) => onChange('startDate', v)}
        placeholder="YYYY-MM-DD"
        error={errors.startDate}
        accessibilityLabel="Fecha de inicio del viaje"
      />
      <Input
        label="Fecha de fin"
        value={form.endDate}
        onChangeText={(v) => onChange('endDate', v)}
        placeholder="YYYY-MM-DD"
        error={errors.endDate}
        accessibilityLabel="Fecha de fin del viaje"
      />
    </View>
  </View>
)

interface Step2Props {
  form: WizardFormData
  onChange: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void
}

const BUDGET_OPTIONS: { value: BudgetTier; label: string; description: string; emoji: string }[] =
  [
    { value: 'budget', label: 'Económico', description: 'Alojamiento y transporte asequibles', emoji: '💸' },
    { value: 'mid', label: 'Estándar', description: 'Buena relación calidad-precio', emoji: '💳' },
    { value: 'premium', label: 'Premium', description: 'Hoteles y experiencias de calidad', emoji: '⭐' },
    { value: 'luxury', label: 'Lujo', description: 'Sin límite — lo mejor de cada destino', emoji: '👑' },
  ]

const Step2Travelers = ({ form, onChange }: Step2Props) => (
  <View>
    <Text className="mb-6 text-xl font-bold text-white">¿Cuántos viajáis?</Text>

    {/* Selector de número de viajeros */}
    <View className="mb-6 items-center">
      <Text className="mb-3 text-sm text-slate-400">Número de viajeros</Text>
      <View className="flex-row items-center gap-6">
        <Pressable
          onPress={() => onChange('travelersCount', Math.max(1, form.travelersCount - 1))}
          accessibilityRole="button"
          accessibilityLabel="Reducir número de viajeros"
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-800 active:bg-slate-700"
          disabled={form.travelersCount <= 1}
        >
          <Text className="text-xl font-bold text-slate-300">−</Text>
        </Pressable>

        <Text
          className="min-w-[2rem] text-center text-3xl font-bold text-white"
          accessibilityLabel={`${form.travelersCount} viajeros`}
        >
          {form.travelersCount}
        </Text>

        <Pressable
          onPress={() => onChange('travelersCount', Math.min(50, form.travelersCount + 1))}
          accessibilityRole="button"
          accessibilityLabel="Aumentar número de viajeros"
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-800 active:bg-slate-700"
        >
          <Text className="text-xl font-bold text-slate-300">+</Text>
        </Pressable>
      </View>
    </View>

    <Text className="mb-3 text-sm text-slate-400">Presupuesto aproximado</Text>
    {BUDGET_OPTIONS.map((option) => (
      <SelectOption
        key={option.value}
        label={option.label}
        description={option.description}
        emoji={option.emoji}
        isSelected={form.budget === option.value}
        onSelect={() => onChange('budget', option.value)}
        accessibilityLabel={`Presupuesto ${option.label}: ${option.description}`}
      />
    ))}
  </View>
)

const PACE_OPTIONS: { value: TravelPace; label: string; description: string; emoji: string }[] = [
  { value: 'slow', label: 'Tranquilo', description: 'Pocas actividades, descanso y disfrute', emoji: '🌿' },
  { value: 'moderate', label: 'Moderado', description: 'Un buen balance entre actividades y descanso', emoji: '🚶' },
  { value: 'intense', label: 'Intenso', description: 'Máximo aprovechamiento de cada día', emoji: '⚡' },
]

interface Step3Props {
  form: WizardFormData
  onChange: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void
}

const Step3Style = ({ form, onChange }: Step3Props) => (
  <View>
    <Text className="mb-6 text-xl font-bold text-white">¿Cómo quieres viajar?</Text>
    <Text className="mb-4 text-sm text-slate-400">
      Selecciona el ritmo que mejor se adapta a ti
    </Text>
    {PACE_OPTIONS.map((option) => (
      <SelectOption
        key={option.value}
        label={option.label}
        description={option.description}
        emoji={option.emoji}
        isSelected={form.pace === option.value}
        onSelect={() => onChange('pace', option.value)}
        accessibilityLabel={`Ritmo ${option.label}: ${option.description}`}
      />
    ))}
  </View>
)

// ─── Pantalla principal del wizard ────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default function NewTripScreen() {
  const { destination } = useLocalSearchParams<{ destination?: string }>()
  const [step, setStep] = useState(0)
  // Pre-rellena la ciudad con el destino pasado desde la pantalla Explorar
  const [form, setForm] = useState<WizardFormData>({
    ...INITIAL_FORM,
    city: destination ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof WizardFormData, string>>>({})

  const { mutateAsync: createTrip, isPending } = useCreateTrip()

  const updateField = <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Limpia el error del campo al modificarlo
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof WizardFormData, string>> = {}

    if (!form.city.trim()) newErrors.city = 'La ciudad es obligatoria'
    if (!form.country.trim()) newErrors.country = 'El país es obligatorio'
    if (form.startDate && !DATE_REGEX.test(form.startDate))
      newErrors.startDate = 'Formato inválido (YYYY-MM-DD)'
    if (form.endDate && !DATE_REGEX.test(form.endDate))
      newErrors.endDate = 'Formato inválido (YYYY-MM-DD)'
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      newErrors.endDate = 'La fecha de fin debe ser posterior al inicio'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 0 && !validateStep1()) return
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
      title: `${form.city}, ${form.country}`,
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
    }

    try {
      const trip = await createTrip(input)
      logger.info('Viaje creado desde el wizard', { tripId: trip.id })
      router.replace(`/(app)/trips/${trip.id}` as never)
    } catch (error) {
      logger.error('Error al crear viaje desde el wizard', { error })
    }
  }

  const STEP_TITLES = ['Destino', 'Viajeros', 'Estilo']

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      {/* Header del wizard */}
      <View className="flex-row items-center border-b border-slate-700 px-4 pb-4 pt-6">
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          className="mr-4 rounded-lg p-1 active:bg-slate-800"
        >
          <Text className="text-2xl text-slate-400">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xs text-slate-500">
            Paso {step + 1} de {STEP_TITLES.length}
          </Text>
          <Text className="text-lg font-bold text-white">{STEP_TITLES[step]}</Text>
        </View>
      </View>

      <StepIndicator current={step} total={STEP_TITLES.length} />

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <Step1Destination form={form} errors={errors} onChange={updateField} />
        )}
        {step === 1 && <Step2Travelers form={form} onChange={updateField} />}
        {step === 2 && <Step3Style form={form} onChange={updateField} />}

        {/* Botón de acción del paso */}
        <View className="mt-8">
          {step < 2 ? (
            <Button label="Continuar" onPress={handleNext} variant="primary" />
          ) : (
            <Button
              label={isPending ? 'Creando viaje...' : 'Crear viaje'}
              onPress={handleCreate}
              variant="primary"
              isLoading={isPending}
              isDisabled={isPending}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
