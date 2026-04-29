import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToastStore } from '@/stores/useToastStore'
import { useProfile, useProfileStats } from '@/hooks/useProfile'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@travelapp/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Genera un color de avatar determinista a partir del email
export const generateAvatarColor = (email: string): string => {
  const colors = [
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#14B8A6', // teal-500
  ]
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Iniciales a partir del nombre completo o email
const getInitials = (profile: UserProfile): string => {
  if (profile.fullName) {
    const parts = profile.fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return profile.email.slice(0, 2).toUpperCase()
}

// Color dinámico de la barra de uso de IA
export const getUsageBarColor = (used: number, limit: number): string => {
  const ratio = limit > 0 ? used / limit : 0
  if (ratio >= 0.9) return 'bg-red-500'
  if (ratio >= 0.6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  children: React.ReactNode
}

const Section = ({ title, children }: SectionProps) => (
  <View className="mx-4 mt-6">
    <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
      {title}
    </Text>
    <View className="overflow-hidden rounded-2xl bg-slate-800">
      {children}
    </View>
  </View>
)

interface RowProps {
  label: string
  value?: string
  onPress?: () => void
  showChevron?: boolean
  destructive?: boolean
  last?: boolean
}

const Row = ({ label, value, onPress, showChevron = false, destructive = false, last = false }: RowProps) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    className={`flex-row items-center justify-between px-4 py-4 active:bg-slate-700
      ${!last ? 'border-b border-slate-700/60' : ''}`}
    accessibilityRole={onPress ? 'button' : 'text'}
    accessibilityLabel={label}
  >
    <Text className={`flex-1 text-base ${destructive ? 'text-red-400' : 'text-slate-200'}`}>
      {label}
    </Text>
    <View className="flex-row items-center gap-2">
      {value !== undefined && (
        <Text className="text-sm text-slate-500">{value}</Text>
      )}
      {showChevron && (
        <Text className="text-slate-600">›</Text>
      )}
    </View>
  </Pressable>
)

const PLAN_COLORS: Record<string, string> = {
  free:  'bg-slate-700 text-slate-300',
  pro:   'bg-indigo-600 text-white',
  team:  'bg-violet-600 text-white',
}

const PLAN_LABELS: Record<string, string> = {
  free:  'Free',
  pro:   'Pro',
  team:  'Team',
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore()
  const showToast = useToastStore.getState().showToast
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: stats } = useProfileStats()

  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true)
            try {
              await signOut()
            } catch (error) {
              logger.error('Error al cerrar sesión desde perfil', { error })
              showToast('No se pudo cerrar sesión. Inténtalo de nuevo.', 'error')
            } finally {
              setIsSigningOut(false)
            }
          },
        },
      ]
    )
  }

  const handleOpenDeleteModal = () => {
    setDeleteStep(1)
    setDeleteConfirmText('')
    setDeleteModalVisible(true)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') return

    setIsDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sin sesión activa')

      const { error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (error) throw error

      setDeleteModalVisible(false)
      showToast('Tu cuenta ha sido eliminada', 'info')
      await signOut()
    } catch (error) {
      logger.error('Error al eliminar cuenta', { error })
      showToast('No se pudo eliminar la cuenta. Contacta a soporte.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  if (profileLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    )
  }

  const displayEmail = profile?.email ?? user?.email ?? ''
  const initials = profile ? getInitials(profile) : displayEmail.slice(0, 2).toUpperCase()
  const avatarColor = generateAvatarColor(displayEmail)
  const plan = profile?.plan ?? 'free'
  const aiUsed = profile?.aiMessagesUsedThisMonth ?? 0
  const aiLimit = profile?.aiMessagesLimit ?? 20
  const usageRatio = aiLimit > 0 ? aiUsed / aiLimit : 0
  const usageBarClass = getUsageBarColor(aiUsed, aiLimit)

  const interestLabels: Record<string, string> = {
    culture: 'Cultura', gastronomy: 'Gastronomía', nature: 'Naturaleza',
    adventure: 'Aventura', beach: 'Playa', city: 'Ciudad', photography: 'Fotografía',
  }
  const paceLabels: Record<string, string> = {
    slow: 'Relajado', moderate: 'Moderado', intense: 'Intenso',
  }
  const budgetLabels: Record<string, string> = {
    budget: 'Económico', mid: 'Moderado', premium: 'Premium', luxury: 'Lujo',
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* ── ENCABEZADO: Avatar + nombre + plan ── */}
      <View className="items-center px-4 pb-6 pt-16">
        <View
          className="mb-3 h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{ backgroundColor: avatarColor }}
          accessibilityLabel={`Avatar de ${displayEmail}`}
        >
          <Text className="text-2xl font-bold text-white">{initials}</Text>
        </View>

        {profile?.fullName ? (
          <Text className="text-xl font-bold text-white">{profile.fullName}</Text>
        ) : null}
        <Text className="mt-0.5 text-sm text-slate-400">{displayEmail}</Text>

        <View className={`mt-3 rounded-full px-3 py-1 ${PLAN_COLORS[plan] ?? 'bg-slate-700 text-slate-300'}`}>
          <Text className="text-xs font-semibold">{PLAN_LABELS[plan] ?? plan}</Text>
        </View>
      </View>

      {/* ── SECCIÓN: Uso de IA ── */}
      <Section title="Uso de IA este mes">
        <View className="px-4 py-4">
          <View className="mb-2 flex-row items-end justify-between">
            <Text className="text-base font-semibold text-white">
              {aiUsed}{' '}
              <Text className="text-sm font-normal text-slate-400">/ {aiLimit} mensajes</Text>
            </Text>
            <Text className="text-xs text-slate-500">
              {Math.round(usageRatio * 100)}%
            </Text>
          </View>

          {/* Barra de progreso */}
          <View className="mb-3 h-2 overflow-hidden rounded-full bg-slate-700">
            <View
              className={`h-2 rounded-full ${usageBarClass}`}
              style={{ width: `${Math.min(usageRatio * 100, 100)}%` }}
            />
          </View>

          {usageRatio >= 0.9 ? (
            <Text className="text-xs text-red-400">
              Estás cerca del límite. Se reinicia el 1 del próximo mes.
            </Text>
          ) : usageRatio >= 0.6 ? (
            <Text className="text-xs text-amber-400">
              Llevas más de la mitad del límite mensual.
            </Text>
          ) : (
            <Text className="text-xs text-slate-500">
              Se reinicia el 1 de cada mes.
            </Text>
          )}

          {plan === 'free' && (
            <Pressable
              onPress={() => showToast('Planes Pro próximamente disponibles', 'info')}
              className="mt-3 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700"
              accessibilityRole="button"
              accessibilityLabel="Actualizar a Pro"
            >
              <Text className="text-sm font-semibold text-white">Actualizar a Pro →</Text>
            </Pressable>
          )}
        </View>
      </Section>

      {/* ── SECCIÓN: Preferencias ── */}
      <Section title="Preferencias">
        <Row
          label="Zona horaria"
          value={profile?.timezone ?? '—'}
          last={false}
        />
        <Row
          label="Moneda"
          value={profile?.preferredCurrency ?? '—'}
          last={false}
        />
        <Row
          label="Ritmo de viaje"
          value={profile?.preferredPace ? paceLabels[profile.preferredPace] : '—'}
          last={false}
        />
        <Row
          label="Intereses"
          value={
            profile?.travelInterests?.length
              ? profile.travelInterests.map((i) => interestLabels[i] ?? i).join(', ')
              : '—'
          }
          last={false}
        />
        <Row
          label="Presupuesto habitual"
          value={profile?.preferredBudget ? budgetLabels[profile.preferredBudget] : '—'}
          last={true}
        />
      </Section>

      <Pressable
        onPress={() => router.push('/(app)/profile/edit' as never)}
        className="mx-4 mt-3 items-center rounded-xl border border-slate-700 py-3 active:bg-slate-800"
        accessibilityRole="button"
        accessibilityLabel="Editar preferencias"
      >
        <Text className="text-sm font-medium text-slate-300">Editar preferencias</Text>
      </Pressable>

      {/* ── SECCIÓN: Estadísticas ── */}
      <Section title="Mis estadísticas">
        <View className="flex-row flex-wrap">
          {[
            { label: 'Viajes', value: String(stats?.totalTrips ?? 0) },
            { label: 'Países', value: String(stats?.countriesVisited ?? 0) },
            { label: 'Itinerarios', value: String(stats?.itinerariesGenerated ?? 0) },
            { label: 'Gastos USD', value: `$${Math.round(stats?.totalExpensesUSD ?? 0)}` },
          ].map((stat, i, arr) => (
            <View
              key={stat.label}
              className={`items-center py-4 ${
                i % 2 === 0 ? 'border-r border-slate-700/60' : ''
              } ${i < arr.length - 2 ? 'border-b border-slate-700/60' : ''}`}
              style={{ width: '50%' }}
            >
              <Text className="text-2xl font-bold text-white">{stat.value}</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{stat.label}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* ── SECCIÓN: Cuenta ── */}
      <Section title="Cuenta">
        <Row
          label="Notificaciones"
          onPress={() => router.push('/(app)/trips/' as never)}
          showChevron
          last={false}
        />
        <Row
          label="Política de privacidad"
          onPress={() => Linking.openURL('https://travelapp.example.com/privacy')}
          showChevron
          last={false}
        />
        <Row
          label="Versión"
          value="1.0.0"
          last={false}
        />
        <Row
          label={isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          onPress={isSigningOut ? undefined : handleSignOut}
          destructive
          last={true}
        />
      </Section>

      {/* Eliminar cuenta */}
      <Pressable
        onPress={handleOpenDeleteModal}
        className="mx-4 mt-4 items-center py-3"
        accessibilityRole="button"
        accessibilityLabel="Eliminar cuenta"
      >
        <Text className="text-sm text-red-500">Eliminar cuenta</Text>
      </Pressable>

      {/* ── MODAL: Eliminar cuenta (2 pasos) ── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/60"
          onPress={() => !isDeleting && setDeleteModalVisible(false)}
        >
          <Pressable
            className="mx-6 w-full rounded-2xl bg-slate-800 p-6"
            onPress={(e) => e.stopPropagation()}
          >
            {deleteStep === 1 ? (
              <>
                <Text className="mb-2 text-lg font-bold text-white">
                  ¿Eliminar tu cuenta?
                </Text>
                <Text className="mb-6 text-sm leading-5 text-slate-400">
                  Esta acción es permanente e irreversible. Se borrarán todos tus viajes,
                  itinerarios, gastos y documentos.
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setDeleteModalVisible(false)}
                    className="flex-1 rounded-xl border border-slate-600 py-3 active:bg-slate-700"
                  >
                    <Text className="text-center text-sm font-medium text-slate-300">
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteStep(2)}
                    className="flex-1 rounded-xl bg-red-600 py-3 active:bg-red-700"
                  >
                    <Text className="text-center text-sm font-semibold text-white">
                      Continuar
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text className="mb-2 text-lg font-bold text-white">
                  Confirma la eliminación
                </Text>
                <Text className="mb-4 text-sm text-slate-400">
                  Escribe{' '}
                  <Text className="font-bold text-white">ELIMINAR</Text>
                  {' '}para confirmar.
                </Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder="ELIMINAR"
                  placeholderTextColor="#475569"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  className="mb-5 rounded-xl bg-slate-700 px-4 py-3 text-base text-white"
                  accessibilityLabel="Escribe ELIMINAR para confirmar"
                  editable={!isDeleting}
                />
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => { setDeleteStep(1); setDeleteConfirmText('') }}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl border border-slate-600 py-3 active:bg-slate-700"
                  >
                    <Text className="text-center text-sm font-medium text-slate-300">
                      Atrás
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'ELIMINAR' || isDeleting}
                    className="flex-1 rounded-xl bg-red-600 py-3 active:bg-red-700"
                    style={{ opacity: deleteConfirmText !== 'ELIMINAR' || isDeleting ? 0.5 : 1 }}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-center text-sm font-semibold text-white">
                        Eliminar
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}
