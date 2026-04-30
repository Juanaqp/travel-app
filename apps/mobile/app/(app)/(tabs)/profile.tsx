import { useState } from 'react'
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToastStore } from '@/stores/useToastStore'
import { useProfile, useProfileStats } from '@/hooks/useProfile'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@travelapp/types'
import type { IconName } from '@/constants/icons'

// ─── Helpers (exportados para tests) ─────────────────────────────────────────

export const generateAvatarColor = (email: string): string => {
  const colors = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
    '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
  ]
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (profile: UserProfile): string => {
  if (profile.fullName) {
    const parts = profile.fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return profile.email.slice(0, 2).toUpperCase()
}

// Mantenido para compatibilidad con tests — devuelve clase NativeWind (no usado en UI nueva)
export const getUsageBarColor = (used: number, limit: number): string => {
  const ratio = limit > 0 ? used / limit : 0
  if (ratio >= 0.9) return 'bg-red-500'
  if (ratio >= 0.6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface SettingsRowProps {
  icon: IconName
  label: string
  onPress?: () => void
  rightElement?: React.ReactNode
  destructive?: boolean
  last?: boolean
}

const SettingsRow = ({ icon, label, onPress, rightElement, destructive = false, last = false }: SettingsRowProps) => {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !rightElement}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={label}
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Icon
        name={icon}
        size="md"
        color={destructive ? colors.semantic.danger : colors.text.secondary}
      />
      <Text
        variant="body"
        color={destructive ? colors.semantic.danger : colors.text.primary}
        style={styles.rowLabel}
      >
        {label}
      </Text>
      {rightElement ?? (onPress ? <Icon name="forward" size="sm" color={colors.text.tertiary} /> : null)}
    </Pressable>
  )
}

interface SectionCardProps {
  title: string
  children: React.ReactNode
}

const SectionCard = ({ title, children }: SectionCardProps) => {
  const { colors } = useTheme()
  return (
    <View style={styles.sectionCard}>
      <Text
        variant="caption"
        weight="semibold"
        color={colors.text.tertiary}
        style={styles.sectionTitle}
      >
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionCardBody, { backgroundColor: colors.background.elevated, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  )
}

const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', team: 'Team' }

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { colors } = useTheme()
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
    Alert.alert('Cerrar sesión', '¿Estás seguro que quieres cerrar sesión?', [
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
    ])
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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.base }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const displayEmail = profile?.email ?? user?.email ?? ''
  const initials = profile ? getInitials(profile) : displayEmail.slice(0, 2).toUpperCase()
  const plan = profile?.plan ?? 'free'
  const aiUsed = profile?.aiMessagesUsedThisMonth ?? 0
  const aiLimit = profile?.aiMessagesLimit ?? 20
  const usageRatio = aiLimit > 0 ? Math.min(aiUsed / aiLimit, 1) : 0

  // Color de la barra de uso (calculado aquí, sin NativeWind)
  const usageBarColor =
    usageRatio >= 0.9
      ? colors.semantic.danger
      : usageRatio >= 0.6
      ? colors.semantic.warning
      : colors.semantic.success

  const STAT_ITEMS = [
    { label: 'Viajes', value: String(stats?.totalTrips ?? 0) },
    { label: 'Países', value: String(stats?.countriesVisited ?? 0) },
    { label: 'Itinerarios', value: String(stats?.itinerariesGenerated ?? 0) },
    { label: 'Gastos USD', value: `$${Math.round(stats?.totalExpensesUSD ?? 0)}` },
  ]

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background.base }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Sección avatar ─────────────────────────────────────────────── */}
      <View style={[styles.avatarCard, { backgroundColor: colors.background.surface }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        {profile?.fullName ? (
          <Text variant="subheading" weight="bold" color={colors.text.primary} align="center">
            {profile.fullName}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.text.secondary} align="center">
          {displayEmail}
        </Text>
        <View style={[styles.planBadge, { borderColor: colors.primary }]}>
          <Text style={[styles.planBadgeText, { color: colors.primary }]}>
            {PLAN_LABELS[plan] ?? plan}
          </Text>
        </View>
      </View>

      {/* ── Grid de estadísticas ──────────────────────────────────────── */}
      <View style={[styles.statsGrid, { backgroundColor: colors.background.elevated, borderColor: colors.border }]}>
        {STAT_ITEMS.map((stat, i) => (
          <View
            key={stat.label}
            style={[
              styles.statCell,
              i % 2 === 0 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              i < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{stat.value}</Text>
            <Text variant="caption" color={colors.text.tertiary}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Uso de IA ─────────────────────────────────────────────────── */}
      <SectionCard title="Uso de IA">
        <View style={styles.aiUsageContent}>
          <View style={styles.aiUsageHeader}>
            <Text variant="body" weight="semibold" color={colors.text.primary}>
              AI Usage this month
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              Resets on the 1st
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${usageRatio * 100}%`, backgroundColor: usageBarColor },
              ]}
            />
          </View>
          <Text variant="caption" color={colors.text.secondary}>
            {aiUsed} of {aiLimit} messages used
          </Text>
        </View>
      </SectionCard>

      {/* ── Sección 1: Cuenta ─────────────────────────────────────────── */}
      <SectionCard title="Cuenta">
        <SettingsRow
          icon="edit"
          label="Edit profile"
          onPress={() => router.push('/(app)/profile/edit' as never)}
        />
        <SettingsRow
          icon="notification"
          label="Notifications"
          onPress={() => {}}
          last
        />
      </SectionCard>

      {/* ── Sección 2: Apariencia ─────────────────────────────────────── */}
      <SectionCard title="Apariencia">
        <SettingsRow
          icon="theme"
          label="Theme"
          rightElement={<ThemeToggle />}
          last
        />
      </SectionCard>

      {/* ── Sección 3: Soporte ───────────────────────────────────────── */}
      <SectionCard title="Soporte">
        <SettingsRow
          icon="ai"
          label="Help & feedback"
          onPress={() => showToast('Feedback próximamente', 'info')}
        />
        <SettingsRow
          icon="visa"
          label="Privacy policy"
          onPress={() => Linking.openURL('https://travelapp.example.com/privacy')}
        />
        <SettingsRow
          icon="visa"
          label="Terms of service"
          onPress={() => Linking.openURL('https://travelapp.example.com/terms')}
          last
        />
      </SectionCard>

      {/* ── Sección 4: Zona de peligro ────────────────────────────────── */}
      <SectionCard title="Cuenta">
        <SettingsRow
          icon="logout"
          label={isSigningOut ? 'Cerrando sesión...' : 'Sign out'}
          onPress={isSigningOut ? undefined : handleSignOut}
          destructive
        />
        <SettingsRow
          icon="delete"
          label="Delete account"
          onPress={handleOpenDeleteModal}
          destructive
          last
        />
      </SectionCard>

      {/* ── Modal: Eliminar cuenta (2 pasos) ─────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => !isDeleting && setDeleteModalVisible(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.background.elevated }]}
            onPress={(e) => e.stopPropagation()}
          >
            {deleteStep === 1 ? (
              <>
                <Text variant="subheading" weight="bold" color={colors.text.primary} style={styles.modalTitle}>
                  ¿Eliminar tu cuenta?
                </Text>
                <Text variant="body" color={colors.text.secondary} style={styles.modalBody}>
                  Esta acción es permanente e irreversible. Se borrarán todos tus viajes,
                  itinerarios, gastos y documentos.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setDeleteModalVisible(false)}
                    style={[styles.modalBtn, { backgroundColor: colors.background.surface, borderColor: colors.border }]}
                  >
                    <Text variant="body" weight="semibold" color={colors.text.secondary}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteStep(2)}
                    style={[styles.modalBtn, styles.modalBtnDanger, { backgroundColor: colors.semantic.danger }]}
                  >
                    <Text variant="body" weight="semibold" color="#FFFFFF">Continuar</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text variant="subheading" weight="bold" color={colors.text.primary} style={styles.modalTitle}>
                  Confirma la eliminación
                </Text>
                <Text variant="body" color={colors.text.secondary} style={styles.modalBody}>
                  Escribe <Text variant="body" weight="bold" color={colors.text.primary}>ELIMINAR</Text> para confirmar.
                </Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder="ELIMINAR"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.background.surface, borderColor: colors.border, color: colors.text.primary },
                  ]}
                  editable={!isDeleting}
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => { setDeleteStep(1); setDeleteConfirmText('') }}
                    disabled={isDeleting}
                    style={[styles.modalBtn, { backgroundColor: colors.background.surface, borderColor: colors.border }]}
                  >
                    <Text variant="body" weight="semibold" color={colors.text.secondary}>Atrás</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'ELIMINAR' || isDeleting}
                    style={[
                      styles.modalBtn,
                      styles.modalBtnDanger,
                      { backgroundColor: colors.semantic.danger, opacity: deleteConfirmText !== 'ELIMINAR' || isDeleting ? 0.5 : 1 },
                    ]}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text variant="body" weight="semibold" color="#FFFFFF">Eliminar</Text>
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

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  // Avatar card
  avatarCard: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 180,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
    paddingTop: 56, // espacio para status bar
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  initials: {
    fontSize: theme.typography.size.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    marginTop: 2,
  },
  planBadgeText: {
    fontSize: theme.typography.size.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  statCell: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: 4,
  },
  statValue: {
    fontSize: theme.typography.size.xl,
    fontWeight: '700',
  },
  // Settings sections
  sectionCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  sectionCardBody: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  rowLabel: {
    flex: 1,
  },
  // AI usage
  aiUsageContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  aiUsageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: theme.radius.full,
  },
  // Delete modal
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    marginHorizontal: theme.spacing.lg,
    width: '100%',
    maxWidth: 360,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  modalTitle: {
    marginBottom: theme.spacing.sm,
  },
  modalBody: {
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.typography.size.base,
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  modalBtnDanger: {
    borderColor: 'transparent',
  },
})
