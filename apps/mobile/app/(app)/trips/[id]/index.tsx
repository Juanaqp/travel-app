import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTrip } from '@/hooks/useTrips'
import { useItinerary } from '@/hooks/useItinerary'
import { useExpenses } from '@/hooks/useExpenses'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import type { Trip, TripStatus, NodeType } from '@travelapp/types'
import type { IconName } from '@/constants/icons'

// ─── Etiquetas de estado ──────────────────────────────────────────────────────

const STATUS_LABEL: Record<TripStatus, string> = {
  planning: 'Planificando',
  confirmed: 'Confirmado',
  active: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<TripStatus, { bg: string; text: string }> = {
  planning: { bg: 'rgba(0,122,255,0.12)', text: '#007AFF' },
  confirmed: { bg: 'rgba(0,122,255,0.12)', text: '#007AFF' },
  active: { bg: 'rgba(0,166,153,0.12)', text: '#00A699' },
  completed: { bg: 'rgba(0,0,0,0.06)', text: '#636366' },
  cancelled: { bg: 'rgba(255,90,95,0.12)', text: '#FF5A5F' },
}

// ─── Icono por tipo de nodo ───────────────────────────────────────────────────

const NODE_TYPE_ICON: Record<NodeType, IconName> = {
  poi: 'attraction',
  restaurant: 'restaurant',
  transport: 'transport',
  hotel_checkin: 'hotel',
  activity: 'activity',
  free_time: 'calendar',
  note: 'filter',
  flight: 'flight',
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

const formatShortDate = (dateStr: string): string => {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '1', 10)
  const day = parseInt(parts[2] ?? '1', 10)
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: trip, isLoading, error, refetch } = useTrip(id ?? '')
  const { data: savedItinerary } = useItinerary(id ?? '')
  const { data: expenses } = useExpenses(id ?? '')
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  // ── Estado de carga ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background.base }]}>
        <Skeleton width="100%" height={280} radius="sm" />
        <View style={styles.loadingContent}>
          <Skeleton width="70%" height={36} radius="md" style={styles.loadingItem} />
          <Skeleton width="50%" height={20} radius="md" style={styles.loadingItem} />
          <Skeleton width="100%" height={80} radius="lg" style={[styles.loadingItem, { marginTop: theme.spacing.lg }]} />
          <Skeleton width="100%" height={80} radius="lg" style={styles.loadingItem} />
        </View>
      </View>
    )
  }

  // ── Estado de error ──────────────────────────────────────────────────────────
  if (error || !trip) {
    return (
      <View style={[styles.root, styles.errorContainer, { backgroundColor: colors.background.base }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.floatingBack, { top: insets.top + theme.spacing.sm, backgroundColor: 'rgba(255,255,255,0.9)' }]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>
        <Icon name="offline" size="xl" color={colors.text.tertiary} />
        <Text variant="subheading" weight="semibold" color={colors.text.secondary} align="center">
          Viaje no encontrado
        </Text>
        <Text variant="body" color={colors.text.tertiary} align="center">
          No pudimos cargar los datos de este viaje
        </Text>
        <Pressable
          onPress={() => { refetch().catch(() => {}) }}
          style={[styles.retryBtn, { borderColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text variant="label" weight="semibold" color={colors.primary}>Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  // ── Datos calculados ─────────────────────────────────────────────────────────
  const primaryDest = trip.destinations[0]
  const statusStyle = STATUS_COLOR[trip.status]
  const totalNodes = savedItinerary?.graph.meta.totalNodes ?? 0
  const totalDays = savedItinerary?.graph.meta.totalDays ?? 0

  // Calcular total gastado en moneda base del viaje
  const spent = (expenses ?? []).reduce((sum, e) => sum + (e.amountInBaseCurrency ?? e.amount), 0)
  const totalBudget = trip.totalBudget ?? 0
  const budgetProgress = totalBudget > 0 ? Math.min(spent / totalBudget, 1) : 0

  // Siguiente nodo del itinerario — primer nodo del primer día a partir de hoy
  const today = new Date().toISOString().slice(0, 10)
  const nextDay = savedItinerary?.graph.days.find((d) => d.date >= today)
  const nextNodeId = nextDay?.nodeIds[0]
  const nextNode = nextNodeId ? savedItinerary?.graph.nodes[nextNodeId] : null

  // Tarjetas de acción
  const actionCards = [
    {
      icon: 'calendar' as IconName,
      label: 'Itinerario',
      hasData: !!savedItinerary,
      onPress: () =>
        savedItinerary
          ? router.push(`/(app)/trips/${id}/itinerary` as never)
          : router.push(`/(app)/trips/${id}/itinerary/generate` as never),
    },
    {
      icon: 'budget' as IconName,
      label: 'Gastos',
      hasData: (expenses?.length ?? 0) > 0,
      onPress: () => router.push(`/(app)/trips/${id}/expenses` as never),
    },
    {
      icon: 'passport' as IconName,
      label: 'Documentos',
      hasData: false,
      onPress: () => router.push(`/(app)/trips/${id}/documents` as never),
    },
    {
      icon: 'map' as IconName,
      label: 'Mapa',
      hasData: !!savedItinerary,
      onPress: () =>
        savedItinerary
          ? router.push(`/(app)/trips/${id}/itinerary/map` as never)
          : router.push(`/(app)/trips/${id}/itinerary` as never),
    },
  ]

  return (
    <View style={[styles.root, { backgroundColor: colors.background.base }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero image ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {trip.coverImageUrl ? (
            <Image
              source={{ uri: trip.coverImageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel={`Foto de portada de ${trip.title}`}
            />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Icon name="flight" size="xl" color="rgba(255,255,255,0.3)" />
            </View>
          )}

          {/* Gradiente sobre la hero image */}
          <View style={styles.heroGradient} />
        </View>

        {/* ── Botón flotante de retroceso ──────────────────────────────────── */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.floatingBack,
            {
              top: insets.top + theme.spacing.sm,
              backgroundColor: 'rgba(255,255,255,0.9)',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Volver a Mis Viajes"
        >
          <Icon name="back" size="md" color="#1A1A1A" />
        </Pressable>

        {/* ── Información del viaje ─────────────────────────────────────── */}
        <View style={[styles.infoSection, { backgroundColor: colors.background.base }]}>
          {/* Nombre */}
          <Text
            variant="title"
            weight="bold"
            color={colors.text.primary}
            numberOfLines={2}
          >
            {trip.title}
          </Text>

          {/* Destino + fechas */}
          <View style={styles.metaRow}>
            {primaryDest && (
              <View style={styles.metaItem}>
                <Icon name="attraction" size="sm" color={colors.text.tertiary} />
                <Text variant="caption" color={colors.text.secondary}>
                  {primaryDest.city}, {primaryDest.country}
                </Text>
              </View>
            )}
            {trip.startDate && (
              <View style={styles.metaItem}>
                <Icon name="calendar" size="sm" color={colors.text.tertiary} />
                <Text variant="caption" color={colors.text.secondary}>
                  {formatShortDate(trip.startDate)}
                  {trip.endDate ? ` – ${formatShortDate(trip.endDate)}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Badge de estado */}
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text
              variant="caption"
              weight="semibold"
              style={{ color: statusStyle.text }}
            >
              {STATUS_LABEL[trip.status]}
            </Text>
          </View>
        </View>

        {/* ── Tarjetas de acción ────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionCardsContainer}
          style={styles.actionCardsRow}
        >
          {actionCards.map((card) => (
            <Pressable
              key={card.label}
              onPress={card.onPress}
              accessibilityRole="button"
              accessibilityLabel={card.label}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: colors.background.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                  ...(isDark ? {} : theme.shadows.sm),
                },
              ]}
            >
              {/* Indicador coral si hay datos */}
              {card.hasData && (
                <View style={[styles.dataIndicator, { backgroundColor: colors.primary }]} />
              )}
              <Icon name={card.icon} size="lg" color={colors.primary} />
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.primary}
                align="center"
                style={styles.actionLabel}
              >
                {card.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Stats (presupuesto + actividades) ────────────────────────── */}
        <View style={styles.statsRow}>
          {/* Card presupuesto */}
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.background.surface,
                borderColor: colors.border,
                ...(isDark ? {} : theme.shadows.sm),
              },
            ]}
          >
            <View style={styles.statHeader}>
              <Icon name="budget" size="md" color={colors.primary} />
              <Text variant="label" weight="semibold" color={colors.text.secondary}>
                Presupuesto
              </Text>
            </View>
            {totalBudget > 0 ? (
              <>
                <Text variant="subheading" weight="bold" color={colors.text.primary}>
                  {trip.baseCurrency} {spent.toFixed(0)} / {totalBudget.toFixed(0)}
                </Text>
                {/* Barra de progreso */}
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${budgetProgress * 100}%`,
                        backgroundColor: budgetProgress > 0.9
                          ? colors.semantic.danger
                          : colors.primary,
                      },
                    ]}
                  />
                </View>
              </>
            ) : (
              <Text variant="body" color={colors.text.tertiary}>
                Sin límite definido
              </Text>
            )}
          </View>

          {/* Card actividades */}
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.background.surface,
                borderColor: colors.border,
                ...(isDark ? {} : theme.shadows.sm),
              },
            ]}
          >
            <View style={styles.statHeader}>
              <Icon name="calendar" size="md" color={colors.primary} />
              <Text variant="label" weight="semibold" color={colors.text.secondary}>
                Actividades
              </Text>
            </View>
            <Text variant="subheading" weight="bold" color={colors.text.primary}>
              {totalNodes}
            </Text>
            {totalDays > 0 && (
              <Text variant="caption" color={colors.text.tertiary}>
                en {totalDays} {totalDays === 1 ? 'día' : 'días'}
              </Text>
            )}
          </View>
        </View>

        {/* ── Próximo en el itinerario ──────────────────────────────────── */}
        {nextNode && (
          <View style={styles.upcomingSection}>
            <Text
              variant="label"
              weight="semibold"
              color={colors.text.secondary}
              style={styles.upcomingTitle}
            >
              Próxima actividad
            </Text>
            <View
              style={[
                styles.upcomingCard,
                {
                  backgroundColor: colors.background.surface,
                  borderColor: colors.border,
                  borderLeftColor: colors.primary,
                },
              ]}
            >
              <View style={styles.upcomingIcon}>
                <Icon
                  name={NODE_TYPE_ICON[nextNode.type] ?? 'calendar'}
                  size="md"
                  color={colors.primary}
                />
              </View>
              <View style={styles.upcomingContent}>
                <Text
                  variant="body"
                  weight="semibold"
                  color={colors.text.primary}
                  numberOfLines={1}
                >
                  {nextNode.name}
                </Text>
                <View style={styles.upcomingMeta}>
                  <Text variant="caption" color={colors.text.secondary}>
                    {nextNode.time}
                  </Text>
                  {nextNode.location.address && (
                    <>
                      <Text variant="caption" color={colors.text.tertiary}> · </Text>
                      <Text
                        variant="caption"
                        color={colors.text.tertiary}
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {nextNode.location.address}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const HERO_HEIGHT = 280

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContent: {
    padding: theme.spacing.md,
  },
  loadingItem: {
    marginBottom: theme.spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  retryBtn: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: '#2C2C2E',
  },
  heroImage: {
    width: '100%',
    height: HERO_HEIGHT,
  },
  heroPlaceholder: {
    backgroundColor: '#3D2B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  floatingBack: {
    position: 'absolute',
    left: theme.spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    marginTop: theme.spacing.sm,
  },
  actionCardsRow: {
    marginTop: theme.spacing.sm,
  },
  actionCardsContainer: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  actionCard: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  dataIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionLabel: {
    fontSize: theme.typography.size.xs,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    marginTop: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.full,
  },
  upcomingSection: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  upcomingTitle: {
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingContent: {
    flex: 1,
    gap: 2,
  },
  upcomingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
