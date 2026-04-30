import { useState } from 'react'
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useToastStore } from '@/stores/useToastStore'
import { logger } from '@/lib/logger'
import type { TravelPace, BudgetTier, TravelInterest } from '@travelapp/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'PEN', 'MXN', 'COP', 'ARS', 'BRL', 'GBP']
const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

const COMMON_TIMEZONES = [
  { value: 'America/New_York',               label: 'Nueva York (ET)' },
  { value: 'America/Chicago',                label: 'Chicago (CT)' },
  { value: 'America/Los_Angeles',            label: 'Los Ángeles (PT)' },
  { value: 'America/Lima',                   label: 'Lima (PET)' },
  { value: 'America/Bogota',                 label: 'Bogotá (COT)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'America/Mexico_City',            label: 'Ciudad de México (CST)' },
  { value: 'America/Sao_Paulo',              label: 'São Paulo (BRT)' },
  { value: 'Europe/London',                  label: 'Londres (GMT/BST)' },
  { value: 'Europe/Paris',                   label: 'París (CET)' },
  { value: 'Europe/Madrid',                  label: 'Madrid (CET)' },
  { value: 'Asia/Tokyo',                     label: 'Tokio (JST)' },
  { value: 'Asia/Dubai',                     label: 'Dubái (GST)' },
  { value: 'Australia/Sydney',               label: 'Sídney (AEDT)' },
]

const PACE_OPTIONS: Array<{ value: TravelPace; label: string; emoji: string }> = [
  { value: 'slow',     label: 'Tranquilo',  emoji: '🌸' },
  { value: 'moderate', label: 'Moderado',   emoji: '⚖️' },
  { value: 'intense',  label: 'Intenso',    emoji: '⚡' },
]

const INTEREST_OPTIONS: Array<{ value: TravelInterest; label: string; emoji: string }> = [
  { value: 'culture',     label: 'Cultura',      emoji: '🏛️' },
  { value: 'gastronomy',  label: 'Gastronomía',  emoji: '🍜' },
  { value: 'nature',      label: 'Naturaleza',   emoji: '🌿' },
  { value: 'adventure',   label: 'Aventura',     emoji: '🧗' },
  { value: 'beach',       label: 'Playa',        emoji: '🏖️' },
  { value: 'city',        label: 'Ciudad',       emoji: '🏙️' },
  { value: 'photography', label: 'Fotografía',   emoji: '📷' },
]

const BUDGET_OPTIONS: Array<{ value: BudgetTier; label: string; emoji: string }> = [
  { value: 'budget',  label: 'Económico', emoji: '💰' },
  { value: 'mid',     label: 'Moderado',  emoji: '💳' },
  { value: 'premium', label: 'Premium',   emoji: '✨' },
  { value: 'luxury',  label: 'Lujo',      emoji: '👑' },
]

// ─── Pantalla de edición de perfil ───────────────────────────────────────────

export default function ProfileEditScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { data: profile } = useProfile()
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile()
  const { showToast } = useToastStore()

  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [timezone, setTimezone] = useState(
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [preferredCurrency, setPreferredCurrency] = useState(profile?.preferredCurrency ?? 'USD')
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferredLanguage ?? 'es')
  const [preferredPace, setPreferredPace] = useState<TravelPace | null>(profile?.preferredPace ?? null)
  const [travelInterests, setTravelInterests] = useState<TravelInterest[]>(profile?.travelInterests ?? [])
  const [preferredBudget, setPreferredBudget] = useState<BudgetTier | null>(profile?.preferredBudget ?? null)

  const isValid = fullName.trim().length >= 2 && travelInterests.length >= 1

  const toggleInterest = (interest: TravelInterest) => {
    setTravelInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    )
  }

  const handleSave = async () => {
    if (!isValid || isPending) return
    try {
      await updateProfile({
        fullName: fullName.trim(),
        timezone,
        preferredCurrency,
        preferredLanguage,
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
      style={[styles.flex, { backgroundColor: colors.background.base }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 4, backgroundColor: colors.background.elevated, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="back" size="lg" color={colors.text.secondary} />
        </Pressable>
        <Text variant="subheading" weight="semibold" color={colors.text.primary}>
          Edit profile
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!isValid || isPending}
          style={[styles.headerBtn, { opacity: !isValid || isPending ? 0.4 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Guardar"
        >
          {isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text variant="body" weight="semibold" color={colors.primary}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar section ──────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarInitials}>
              {fullName.trim().slice(0, 2).toUpperCase() || 'ME'}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto">
            <Text variant="caption" weight="semibold" color={colors.primary}>
              Change photo
            </Text>
          </Pressable>
        </View>

        {/* ── Card 1: Personal ─────────────────────────────────── */}
        <FormCard title="Personal">
          <FormField label="Full name *">
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Tu nombre"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              maxLength={80}
              style={[styles.input, { color: colors.text.primary }]}
            />
          </FormField>
        </FormCard>

        {/* ── Card 2: Travel preferences ────────────────────────── */}
        <FormCard title="Travel preferences">
          {/* Moneda */}
          <FormField label="Currency">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {CURRENCIES.map((cur) => {
                const isActive = preferredCurrency === cur
                return (
                  <Pressable
                    key={cur}
                    onPress={() => setPreferredCurrency(cur)}
                    style={[
                      styles.pill,
                      isActive
                        ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                        : { backgroundColor: colors.background.surface, borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text variant="caption" weight="semibold" color={isActive ? '#FFFFFF' : colors.text.secondary}>
                      {cur}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </FormField>

          {/* Idioma */}
          <FormField label="Language">
            <View style={styles.segmentRow}>
              {LANGUAGES.map((lang) => {
                const isActive = preferredLanguage === lang.value
                return (
                  <Pressable
                    key={lang.value}
                    onPress={() => setPreferredLanguage(lang.value)}
                    style={[
                      styles.segment,
                      isActive
                        ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                        : { backgroundColor: colors.background.surface, borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text variant="caption" weight="semibold" color={isActive ? '#FFFFFF' : colors.text.secondary}>
                      {lang.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </FormField>

          {/* Zona horaria */}
          <FormField label="Timezone" last>
            <Pressable
              onPress={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
              style={[styles.tzDetect, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}
              accessibilityRole="button"
            >
              <Text variant="caption" style={{ fontSize: 14 }}>📍</Text>
              <Text variant="caption" weight="semibold" color={colors.primary}>
                Auto-detect · {timezone}
              </Text>
            </Pressable>
            <View style={[styles.tzList, { borderColor: colors.border }]}>
              {COMMON_TIMEZONES.map((tz, i) => (
                <Pressable
                  key={tz.value}
                  onPress={() => setTimezone(tz.value)}
                  style={[
                    styles.tzRow,
                    i < COMMON_TIMEZONES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    variant="caption"
                    weight={timezone === tz.value ? 'semibold' : 'regular'}
                    color={timezone === tz.value ? colors.primary : colors.text.secondary}
                  >
                    {tz.label}
                  </Text>
                  {timezone === tz.value ? (
                    <Icon name="checkin" size="sm" color={colors.primary} filled />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </FormField>
        </FormCard>

        {/* ── Card 3: Travel style ─────────────────────────────── */}
        <FormCard title="Travel style">
          {/* Pace */}
          <FormField label="Pace">
            <View style={styles.segmentRow}>
              {PACE_OPTIONS.map((opt) => {
                const isActive = preferredPace === opt.value
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPreferredPace(opt.value)}
                    style={[
                      styles.segment,
                      { flex: 1 },
                      isActive
                        ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                        : { backgroundColor: colors.background.surface, borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                    <Text variant="caption" weight="semibold" color={isActive ? '#FFFFFF' : colors.text.secondary}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </FormField>

          {/* Interests */}
          <FormField label="Interests (select at least 1)">
            <View style={styles.interestWrap}>
              {INTEREST_OPTIONS.map((interest) => {
                const selected = travelInterests.includes(interest.value)
                return (
                  <Pressable
                    key={interest.value}
                    onPress={() => toggleInterest(interest.value)}
                    style={[
                      styles.interestPill,
                      selected
                        ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                        : { backgroundColor: colors.background.surface, borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={{ fontSize: 14 }}>{interest.emoji}</Text>
                    <Text variant="caption" weight="semibold" color={selected ? '#FFFFFF' : colors.text.secondary}>
                      {interest.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </FormField>

          {/* Budget */}
          <FormField label="Budget" last>
            <View style={styles.segmentRow}>
              {BUDGET_OPTIONS.map((opt) => {
                const isActive = preferredBudget === opt.value
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPreferredBudget(opt.value)}
                    style={[
                      styles.segment,
                      { flex: 1 },
                      isActive
                        ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                        : { backgroundColor: colors.background.surface, borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                    <Text variant="caption" weight="semibold" color={isActive ? '#FFFFFF' : colors.text.secondary} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </FormField>
        </FormCard>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Form sub-components ──────────────────────────────────────────────────────

const FormCard = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { colors } = useTheme()
  return (
    <View style={styles.formCard}>
      <Text variant="caption" weight="semibold" color={colors.text.tertiary} style={styles.formCardTitle}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.formCardBody, { backgroundColor: colors.background.elevated, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  )
}

const FormField = ({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) => {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.formField,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text variant="caption" weight="semibold" color={colors.text.tertiary} style={styles.fieldLabel}>
        {label}
      </Text>
      {children}
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 60,
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.xs,
  },
  scrollContent: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: theme.typography.size.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formCard: {
    marginHorizontal: theme.spacing.md,
  },
  formCardTitle: {
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  formCardBody: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  formField: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    letterSpacing: 0.3,
  },
  input: {
    fontSize: theme.typography.size.base,
    paddingVertical: 4,
  },
  pillRow: {
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  interestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  tzDetect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.xs,
  },
  tzList: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
})
