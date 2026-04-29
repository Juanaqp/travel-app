import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useOnboarding } from '@/hooks/useOnboarding'
import { useToastStore } from '@/stores/useToastStore'
import { logger } from '@/lib/logger'
import type { TravelPace, BudgetTier, TravelInterest } from '@travelapp/types'

// ─── Constantes de configuración ─────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'PEN', 'MXN', 'COP', 'ARS', 'BRL', 'GBP']

const COMMON_TIMEZONES = [
  { value: 'America/New_York',               label: 'Nueva York (ET)' },
  { value: 'America/Chicago',                label: 'Chicago (CT)' },
  { value: 'America/Denver',                 label: 'Denver (MT)' },
  { value: 'America/Los_Angeles',            label: 'Los Ángeles (PT)' },
  { value: 'America/Lima',                   label: 'Lima (PET)' },
  { value: 'America/Bogota',                 label: 'Bogotá (COT)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'America/Mexico_City',            label: 'Ciudad de México (CST)' },
  { value: 'America/Sao_Paulo',              label: 'São Paulo (BRT)' },
  { value: 'America/Caracas',                label: 'Caracas (VET)' },
  { value: 'Europe/London',                  label: 'Londres (GMT/BST)' },
  { value: 'Europe/Paris',                   label: 'París (CET)' },
  { value: 'Europe/Madrid',                  label: 'Madrid (CET)' },
  { value: 'Europe/Berlin',                  label: 'Berlín (CET)' },
  { value: 'Europe/Rome',                    label: 'Roma (CET)' },
  { value: 'Europe/Moscow',                  label: 'Moscú (MSK)' },
  { value: 'Asia/Dubai',                     label: 'Dubái (GST)' },
  { value: 'Asia/Kolkata',                   label: 'India (IST)' },
  { value: 'Asia/Bangkok',                   label: 'Bangkok (ICT)' },
  { value: 'Asia/Singapore',                 label: 'Singapur (SGT)' },
  { value: 'Asia/Tokyo',                     label: 'Tokio (JST)' },
  { value: 'Asia/Shanghai',                  label: 'Shanghái (CST)' },
  { value: 'Australia/Sydney',               label: 'Sídney (AEDT)' },
  { value: 'Pacific/Auckland',               label: 'Auckland (NZDT)' },
]

const PACE_OPTIONS: Array<{ value: TravelPace; label: string; emoji: string; desc: string }> = [
  { value: 'slow',     label: 'Relajado',  emoji: '🌸', desc: 'Pocos lugares, tiempo para disfrutar cada uno' },
  { value: 'moderate', label: 'Moderado',  emoji: '⚖️', desc: 'Balance entre actividad y descanso' },
  { value: 'intense',  label: 'Intenso',   emoji: '⚡', desc: 'Máximo contenido, muchos lugares al día' },
]

const INTEREST_OPTIONS: Array<{ value: TravelInterest; label: string; emoji: string }> = [
  { value: 'culture',      label: 'Cultura',      emoji: '🏛️' },
  { value: 'gastronomy',   label: 'Gastronomía',  emoji: '🍜' },
  { value: 'nature',       label: 'Naturaleza',   emoji: '🌿' },
  { value: 'adventure',    label: 'Aventura',     emoji: '🧗' },
  { value: 'beach',        label: 'Playa',        emoji: '🏖️' },
  { value: 'city',         label: 'Ciudad',       emoji: '🏙️' },
  { value: 'photography',  label: 'Fotografía',   emoji: '📷' },
]

const BUDGET_OPTIONS: Array<{ value: BudgetTier; label: string; emoji: string; desc: string }> = [
  { value: 'budget',  label: 'Económico', emoji: '💰', desc: 'Hostales, transporte público, mercados' },
  { value: 'mid',     label: 'Moderado',  emoji: '💳', desc: 'Hoteles 3★, tours locales, restaurantes' },
  { value: 'premium', label: 'Premium',   emoji: '✨', desc: 'Hoteles 4-5★, experiencias curadas' },
  { value: 'luxury',  label: 'Lujo',      emoji: '👑', desc: 'Hoteles boutique, servicios exclusivos' },
]

// ─── Pantalla de onboarding en 2 pasos ───────────────────────────────────────

export default function OnboardingSetupScreen() {
  const router = useRouter()
  const { completeOnboarding, isCompleting } = useOnboarding()
  const { showToast } = useToastStore()

  const [step, setStep] = useState<1 | 2>(1)

  // Paso 1 — datos básicos
  const [fullName, setFullName]                 = useState('')
  const [timezone, setTimezone]                 = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [preferredCurrency, setPreferredCurrency] = useState('USD')

  // Paso 2 — estilo de viaje
  const [preferredPace, setPreferredPace]       = useState<TravelPace | null>(null)
  const [travelInterests, setTravelInterests]   = useState<TravelInterest[]>([])
  const [preferredBudget, setPreferredBudget]   = useState<BudgetTier | null>(null)

  // Validaciones
  const isStep1Valid = fullName.trim().length >= 2
  const isStep2Valid =
    preferredPace !== null &&
    travelInterests.length >= 1 &&
    preferredBudget !== null

  const toggleInterest = (interest: TravelInterest) => {
    setTravelInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    )
  }

  const handleAutoDetectTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezone(detected)
  }

  const handleComplete = async () => {
    try {
      await completeOnboarding({
        fullName: fullName.trim(),
        timezone,
        preferredCurrency,
        preferredPace: preferredPace!,
        travelInterests,
        preferredBudget: preferredBudget!,
      })
      router.replace('/(app)/(tabs)')
    } catch (err) {
      logger.error('Error al completar onboarding', { err })
      showToast('No pudimos guardar tu perfil. Inténtalo de nuevo.', 'error')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera con indicador de progreso */}
        <View className="px-6 pb-2 pt-14">
          <View className="mb-6 flex-row items-center gap-2">
            <View className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-500' : 'bg-slate-700'}`} />
            <View className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-500' : 'bg-slate-700'}`} />
          </View>
          <Text className="text-xs font-medium uppercase tracking-widest text-indigo-400">
            Paso {step} de 2
          </Text>
          <Text className="mt-1 text-2xl font-bold text-white">
            {step === 1 ? 'Cuéntanos sobre ti' : 'Tu estilo de viaje'}
          </Text>
          <Text className="mt-1 text-sm text-slate-400">
            {step === 1
              ? 'Esta información personaliza tu experiencia.'
              : 'Así generaremos itinerarios perfectos para ti.'}
          </Text>
        </View>

        {/* ── PASO 1 ── */}
        {step === 1 && (
          <View className="px-6 pt-4">
            {/* Nombre completo */}
            <Text className="mb-2 text-sm font-medium text-slate-300">Nombre completo</Text>
            <TextInput
              className="mb-6 rounded-xl bg-slate-800 px-4 py-4 text-base text-white"
              placeholder="Tu nombre"
              placeholderTextColor="#64748B"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              maxLength={80}
            />

            {/* Zona horaria */}
            <Text className="mb-2 text-sm font-medium text-slate-300">Zona horaria</Text>
            <Pressable
              onPress={handleAutoDetectTimezone}
              className="mb-3 flex-row items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-900/30 px-4 py-3 active:bg-indigo-900/50"
            >
              <Text className="text-base">📍</Text>
              <View className="flex-1">
                <Text className="text-sm font-medium text-indigo-300">Detectar automáticamente</Text>
                <Text className="text-xs text-slate-400">{timezone}</Text>
              </View>
            </Pressable>

            <View className="mb-6 overflow-hidden rounded-xl bg-slate-800">
              {COMMON_TIMEZONES.map((tz, index) => (
                <Pressable
                  key={tz.value}
                  onPress={() => setTimezone(tz.value)}
                  className={`flex-row items-center justify-between px-4 py-3 active:bg-slate-700
                    ${index < COMMON_TIMEZONES.length - 1 ? 'border-b border-slate-700' : ''}
                  `}
                >
                  <Text className={`text-sm ${timezone === tz.value ? 'font-semibold text-indigo-400' : 'text-slate-300'}`}>
                    {tz.label}
                  </Text>
                  {timezone === tz.value && (
                    <Text className="text-indigo-400">✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Moneda preferida */}
            <Text className="mb-2 text-sm font-medium text-slate-300">Moneda preferida</Text>
            <View className="mb-8 flex-row flex-wrap gap-2">
              {CURRENCIES.map((currency) => (
                <Pressable
                  key={currency}
                  onPress={() => setPreferredCurrency(currency)}
                  className={`rounded-xl px-4 py-2.5 active:opacity-80 ${
                    preferredCurrency === currency
                      ? 'bg-indigo-600'
                      : 'bg-slate-800'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${
                    preferredCurrency === currency ? 'text-white' : 'text-slate-300'
                  }`}>
                    {currency}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Botón Siguiente */}
            <Pressable
              onPress={() => setStep(2)}
              disabled={!isStep1Valid}
              className={`rounded-2xl py-4 ${isStep1Valid ? 'bg-indigo-600 active:bg-indigo-700' : 'bg-slate-700 opacity-50'}`}
            >
              <Text className="text-center text-base font-semibold text-white">
                Siguiente →
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── PASO 2 ── */}
        {step === 2 && (
          <View className="px-6 pt-4">
            {/* Ritmo de viaje */}
            <Text className="mb-3 text-sm font-medium text-slate-300">Ritmo de viaje</Text>
            <View className="mb-6 gap-3">
              {PACE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPreferredPace(option.value)}
                  className={`flex-row items-center gap-4 rounded-2xl p-4 active:opacity-80 ${
                    preferredPace === option.value
                      ? 'border border-indigo-500 bg-indigo-900/40'
                      : 'bg-slate-800'
                  }`}
                >
                  <Text className="text-3xl">{option.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${
                      preferredPace === option.value ? 'text-indigo-300' : 'text-white'
                    }`}>
                      {option.label}
                    </Text>
                    <Text className="text-xs text-slate-400">{option.desc}</Text>
                  </View>
                  {preferredPace === option.value && (
                    <Text className="text-xl text-indigo-400">✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Intereses de viaje (multi-select, mínimo 1) */}
            <Text className="mb-1 text-sm font-medium text-slate-300">Intereses</Text>
            <Text className="mb-3 text-xs text-slate-500">Selecciona al menos uno</Text>
            <View className="mb-6 flex-row flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const selected = travelInterests.includes(interest.value)
                return (
                  <Pressable
                    key={interest.value}
                    onPress={() => toggleInterest(interest.value)}
                    className={`flex-row items-center gap-2 rounded-xl px-4 py-2.5 active:opacity-80 ${
                      selected ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                  >
                    <Text className="text-base">{interest.emoji}</Text>
                    <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-300'}`}>
                      {interest.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Nivel de presupuesto */}
            <Text className="mb-3 text-sm font-medium text-slate-300">Presupuesto habitual</Text>
            <View className="mb-8 gap-3">
              {BUDGET_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPreferredBudget(option.value)}
                  className={`flex-row items-center gap-4 rounded-2xl p-4 active:opacity-80 ${
                    preferredBudget === option.value
                      ? 'border border-indigo-500 bg-indigo-900/40'
                      : 'bg-slate-800'
                  }`}
                >
                  <Text className="text-3xl">{option.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${
                      preferredBudget === option.value ? 'text-indigo-300' : 'text-white'
                    }`}>
                      {option.label}
                    </Text>
                    <Text className="text-xs text-slate-400">{option.desc}</Text>
                  </View>
                  {preferredBudget === option.value && (
                    <Text className="text-xl text-indigo-400">✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Botones Atrás / Completar */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setStep(1)}
                className="flex-1 rounded-2xl border border-slate-600 py-4 active:bg-slate-800"
              >
                <Text className="text-center text-base font-medium text-slate-300">
                  ← Atrás
                </Text>
              </Pressable>

              <Pressable
                onPress={handleComplete}
                disabled={!isStep2Valid || isCompleting}
                className={`flex-1 rounded-2xl py-4 ${
                  isStep2Valid && !isCompleting
                    ? 'bg-indigo-600 active:bg-indigo-700'
                    : 'bg-slate-700 opacity-50'
                }`}
              >
                {isCompleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-center text-base font-semibold text-white">
                    Empezar ✓
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
