import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useOnboarding } from '@/hooks/useOnboarding'
import { useToastStore } from '@/stores/useToastStore'
import { logger } from '@/lib/logger'
import { useTheme } from '@/hooks/useTheme'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
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
  const { colors, spacing, typography, radius } = useTheme()

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
    <ScreenWrapper scroll={false} padding={false} backgroundColor={colors.background.base}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera con indicador de progreso */}
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, paddingTop: spacing.xxl }}>
          <View style={{ marginBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ height: 8, flex: 1, borderRadius: 4, backgroundColor: step >= 1 ? colors.primary : colors.border }} />
            <View style={{ height: 8, flex: 1, borderRadius: 4, backgroundColor: step >= 2 ? colors.primary : colors.border }} />
          </View>
          <Text style={{ fontSize: typography.size.xs, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1, color: colors.primary }}>
            Paso {step} de 2
          </Text>
          <Text style={{ marginTop: spacing.xs, fontSize: typography.size.xxl, fontWeight: '700', color: colors.text.primary }}>
            {step === 1 ? 'Cuéntanos sobre ti' : 'Tu estilo de viaje'}
          </Text>
          <Text style={{ marginTop: spacing.xs, fontSize: typography.size.sm, color: colors.text.secondary }}>
            {step === 1
              ? 'Esta información personaliza tu experiencia.'
              : 'Así generaremos itinerarios perfectos para ti.'}
          </Text>
        </View>

        {/* ── PASO 1 ── */}
        {step === 1 && (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            {/* Nombre completo */}
            <Input
              label="Nombre completo"
              placeholder="Tu nombre"
              value={fullName}
              onChangeText={setFullName}
              style={{ marginBottom: spacing.xl }}
            />

            {/* Zona horaria */}
            <Text style={{ marginBottom: spacing.xs, fontSize: typography.size.sm, fontWeight: '500', color: colors.text.secondary }}>Zona horaria</Text>
            <Pressable
              onPress={handleAutoDetectTimezone}
              style={{
                marginBottom: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.primary,
                backgroundColor: colors.primary + '1A', // 10% opacity
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ fontSize: typography.size.md }}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.size.sm, fontWeight: '500', color: colors.primary }}>Detectar automáticamente</Text>
                <Text style={{ fontSize: typography.size.xs, color: colors.text.secondary }}>{timezone}</Text>
              </View>
            </Pressable>

            <View style={{ marginBottom: spacing.xl, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.background.surface }}>
              {COMMON_TIMEZONES.map((tz, index) => (
                <Pressable
                  key={tz.value}
                  onPress={() => setTimezone(tz.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: timezone === tz.value ? colors.background.elevated : 'transparent',
                    borderBottomWidth: index < COMMON_TIMEZONES.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{
                    fontSize: typography.size.sm,
                    fontWeight: timezone === tz.value ? '600' : '400',
                    color: timezone === tz.value ? colors.primary : colors.text.secondary
                  }}>
                    {tz.label}
                  </Text>
                  {timezone === tz.value && (
                    <Text style={{ color: colors.primary }}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Moneda preferida */}
            <Text style={{ marginBottom: spacing.xs, fontSize: typography.size.sm, fontWeight: '500', color: colors.text.secondary }}>Moneda preferida</Text>
            <View style={{ marginBottom: spacing.xxl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {CURRENCIES.map((currency) => (
                <Pressable
                  key={currency}
                  onPress={() => setPreferredCurrency(currency)}
                  style={{
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: preferredCurrency === currency ? colors.primary : colors.background.surface,
                  }}
                >
                  <Text style={{
                    fontSize: typography.size.sm,
                    fontWeight: '600',
                    color: preferredCurrency === currency ? colors.text.primary : colors.text.secondary
                  }}>
                    {currency}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Botón Siguiente */}
            <Button
              label="Siguiente →"
              variant="primary"
              onPress={() => setStep(2)}
              disabled={!isStep1Valid}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}

        {/* ── PASO 2 ── */}
        {step === 2 && (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            {/* Ritmo de viaje */}
            <Text style={{ marginBottom: spacing.sm, fontSize: typography.size.sm, fontWeight: '500', color: colors.text.secondary }}>Ritmo de viaje</Text>
            <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
              {PACE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPreferredPace(option.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    borderWidth: preferredPace === option.value ? 1 : 0,
                    borderColor: colors.primary,
                    backgroundColor: preferredPace === option.value ? colors.primary + '1A' : colors.background.surface, // 10% opacity
                  }}
                >
                  <Text style={{ fontSize: typography.size.xxxl }}>{option.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: typography.size.md,
                      fontWeight: '600',
                      color: preferredPace === option.value ? colors.primary : colors.text.primary
                    }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontSize: typography.size.xs, color: colors.text.secondary }}>{option.desc}</Text>
                  </View>
                  {preferredPace === option.value && (
                    <Text style={{ fontSize: typography.size.xl, color: colors.primary }}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Intereses de viaje (multi-select, mínimo 1) */}
            <Text style={{ marginBottom: spacing.xs, fontSize: typography.size.sm, fontWeight: '500', color: colors.text.secondary }}>Intereses</Text>
            <Text style={{ marginBottom: spacing.sm, fontSize: typography.size.xs, color: colors.text.tertiary }}>Selecciona al menos uno</Text>
            <View style={{ marginBottom: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {INTEREST_OPTIONS.map((interest) => {
                const selected = travelInterests.includes(interest.value)
                return (
                  <Pressable
                    key={interest.value}
                    onPress={() => toggleInterest(interest.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      backgroundColor: selected ? colors.primary : colors.background.surface,
                    }}
                  >
                    <Text style={{ fontSize: typography.size.md }}>{interest.emoji}</Text>
                    <Text style={{
                      fontSize: typography.size.sm,
                      fontWeight: '500',
                      color: selected ? colors.text.primary : colors.text.secondary
                    }}>
                      {interest.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Nivel de presupuesto */}
            <Text style={{ marginBottom: spacing.sm, fontSize: typography.size.sm, fontWeight: '500', color: colors.text.secondary }}>Presupuesto habitual</Text>
            <View style={{ marginBottom: spacing.xxl, gap: spacing.sm }}>
              {BUDGET_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPreferredBudget(option.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    borderWidth: preferredBudget === option.value ? 1 : 0,
                    borderColor: colors.primary,
                    backgroundColor: preferredBudget === option.value ? colors.primary + '1A' : colors.background.surface,
                  }}
                >
                  <Text style={{ fontSize: typography.size.xxxl }}>{option.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: typography.size.md,
                      fontWeight: '600',
                      color: preferredBudget === option.value ? colors.primary : colors.text.primary
                    }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontSize: typography.size.xs, color: colors.text.secondary }}>{option.desc}</Text>
                  </View>
                  {preferredBudget === option.value && (
                    <Text style={{ fontSize: typography.size.xl, color: colors.primary }}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Botones Atrás / Completar */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="← Atrás"
                variant="secondary"
                onPress={() => setStep(1)}
                style={{ flex: 1 }}
              />

              <Button
                label="Empezar ✓"
                variant="primary"
                onPress={handleComplete}
                disabled={!isStep2Valid || isCompleting}
                loading={isCompleting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  )
}
