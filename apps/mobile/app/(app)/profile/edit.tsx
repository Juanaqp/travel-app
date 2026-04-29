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
import { router } from 'expo-router'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useToastStore } from '@/stores/useToastStore'
import { logger } from '@/lib/logger'
import type { TravelPace, BudgetTier, TravelInterest } from '@travelapp/types'

// ─── Constantes (mismas que el onboarding) ───────────────────────────────────

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
  { value: 'slow',     label: 'Relajado',  emoji: '🌸', desc: 'Pocos lugares, tiempo para disfrutar' },
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
  { value: 'budget',  label: 'Económico', emoji: '💰', desc: 'Hostales, transporte público' },
  { value: 'mid',     label: 'Moderado',  emoji: '💳', desc: 'Hoteles 3★, tours locales' },
  { value: 'premium', label: 'Premium',   emoji: '✨', desc: 'Hoteles 4-5★, experiencias curadas' },
  { value: 'luxury',  label: 'Lujo',      emoji: '👑', desc: 'Hoteles boutique, servicios exclusivos' },
]

// ─── Pantalla de edición de perfil ───────────────────────────────────────────

export default function ProfileEditScreen() {
  const { data: profile } = useProfile()
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile()
  const { showToast } = useToastStore()

  // Pre-rellenar con datos actuales del perfil
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [timezone, setTimezone] = useState(
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [preferredCurrency, setPreferredCurrency] = useState(profile?.preferredCurrency ?? 'USD')
  const [preferredPace, setPreferredPace] = useState<TravelPace | null>(profile?.preferredPace ?? null)
  const [travelInterests, setTravelInterests] = useState<TravelInterest[]>(profile?.travelInterests ?? [])
  const [preferredBudget, setPreferredBudget] = useState<BudgetTier | null>(profile?.preferredBudget ?? null)

  const isValid = fullName.trim().length >= 2 && travelInterests.length >= 1

  const toggleInterest = (interest: TravelInterest) => {
    setTravelInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    )
  }

  const handleSave = async () => {
    if (!isValid || isPending) return

    try {
      await updateProfile({
        fullName: fullName.trim(),
        timezone,
        preferredCurrency,
        preferredPace: preferredPace ?? undefined,
        travelInterests,
        preferredBudget: preferredBudget ?? undefined,
      })
      showToast('Preferencias actualizadas', 'success')
      router.back()
    } catch (error) {
      logger.error('Error al guardar preferencias', { error })
      showToast('No se pudo guardar. Inténtalo de nuevo.', 'error')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera */}
        <View className="flex-row items-center justify-between px-4 pb-2 pt-14">
          <Pressable
            onPress={() => router.back()}
            className="rounded-xl px-3 py-2 active:bg-slate-800"
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Text className="text-base text-slate-400">← Volver</Text>
          </Pressable>
          <Text className="text-base font-semibold text-white">Editar preferencias</Text>
          <Pressable
            onPress={handleSave}
            disabled={!isValid || isPending}
            className="rounded-xl px-3 py-2 active:bg-slate-800"
            style={{ opacity: !isValid || isPending ? 0.4 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Guardar"
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text className="text-base font-semibold text-indigo-400">Guardar</Text>
            )}
          </Pressable>
        </View>

        <View className="px-4 pt-4">
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
            onPress={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
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
                  ${index < COMMON_TIMEZONES.length - 1 ? 'border-b border-slate-700' : ''}`}
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
          <View className="mb-6 flex-row flex-wrap gap-2">
            {CURRENCIES.map((currency) => (
              <Pressable
                key={currency}
                onPress={() => setPreferredCurrency(currency)}
                className={`rounded-xl px-4 py-2.5 active:opacity-80 ${
                  preferredCurrency === currency ? 'bg-indigo-600' : 'bg-slate-800'
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

          {/* Intereses */}
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

          {/* Presupuesto */}
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

          {/* Botón guardar */}
          <Pressable
            onPress={handleSave}
            disabled={!isValid || isPending}
            className={`rounded-2xl py-4 ${isValid && !isPending ? 'bg-indigo-600 active:bg-indigo-700' : 'bg-slate-700 opacity-50'}`}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-center text-base font-semibold text-white">
                Guardar cambios
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
