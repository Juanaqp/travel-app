import { useState } from 'react'
import { View, FlatList, RefreshControl, ScrollView, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useTrips } from '@/hooks/useTrips'
import { TripCard } from '@/components/TripCard'
import { OfflineBanner } from '@/components/OfflineBanner'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import type { Trip, TripStatus } from '@travelapp/types'

// ─── Filtros de estado ────────────────────────────────────────────────────────

interface StatusFilter {
  label: string
  statuses: TripStatus[] | null  // null = mostrar todos
}

const STATUS_FILTERS: StatusFilter[] = [
  { label: 'Todo', statuses: null },
  { label: 'Próximos', statuses: ['planning', 'confirmed'] },
  { label: 'Activo', statuses: ['active'] },
  { label: 'Completados', statuses: ['completed'] },
]

// ─── Tab Mis Viajes ───────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>(STATUS_FILTERS[0]!)
  const { data: trips, isLoading, error, refetch, isRefetching } = useTrips()
  const { colors, isDark } = useTheme()

  const handleTripPress = (trip: Trip) => {
    router.push(`/(app)/trips/${trip.id}` as never)
  }

  const handleNewTrip = () => {
    router.push('/(app)/trips/new' as never)
  }

  // Filtrar viajes según la pill activa
  const filteredTrips = activeFilter.statuses
    ? (trips ?? []).filter((t) => (activeFilter.statuses as TripStatus[]).includes(t.status))
    : (trips ?? [])

  return (
    <ScreenWrapper
      scroll={false}
      padding={false}
      header={{
        title: 'Mis Viajes',
        large: true,
        rightAction: {
          icon: 'add',
          onPress: handleNewTrip,
          label: 'Nuevo viaje',
        },
      }}
    >
      <OfflineBanner />

      {/* Pills de filtro */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        style={styles.pillsRow}
      >
        {STATUS_FILTERS.map((filter) => {
          const isActive = activeFilter.label === filter.label
          return (
            <Pressable
              key={filter.label}
              onPress={() => setActiveFilter(filter)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por ${filter.label}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.pill,
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
                {filter.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Estado de carga */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              width="100%"
              height={220}
              radius="lg"
              style={[styles.skeletonCard, { borderRadius: theme.radius.xl }]}
            />
          ))}
        </View>
      ) : error ? (
        // Estado de error
        <View style={styles.errorContainer}>
          <Icon name="offline" size="xl" color={colors.text.tertiary} />
          <Text
            variant="subheading"
            weight="semibold"
            color={colors.text.secondary}
            align="center"
            style={styles.errorTitle}
          >
            No pudimos cargar tus viajes
          </Text>
          <Text
            variant="body"
            color={colors.text.tertiary}
            align="center"
          >
            Comprueba tu conexión e inténtalo de nuevo
          </Text>
          <Button
            label="Reintentar"
            onPress={() => { refetch().catch(() => {}) }}
            variant="secondary"
            style={styles.retryButton}
          />
        </View>
      ) : (
        // Lista de viajes
        <FlatList
          data={filteredTrips}
          keyExtractor={(trip) => trip.id}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={() => handleTripPress(item)}
              variant="full"
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            filteredTrips.length === 0 && styles.emptyList,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => { refetch().catch(() => {}) }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {/* Icono ilustración */}
              <View style={[styles.emptyIconWrapper, { backgroundColor: `${colors.primary}18` }]}>
                <Icon name="explore" size="xl" color={colors.primary} />
              </View>
              <Text
                variant="heading"
                weight="bold"
                color={colors.text.primary}
                align="center"
                style={styles.emptyTitle}
              >
                Aún no tienes viajes
              </Text>
              <Text
                variant="body"
                color={colors.text.secondary}
                align="center"
                style={styles.emptySubtitle}
              >
                Empieza a planificar tu primera aventura
              </Text>
              <Button
                label="Crear un viaje"
                onPress={handleNewTrip}
                variant="primary"
                icon="add"
                style={styles.emptyButton}
              />
            </View>
          }
        />
      )}
    </ScreenWrapper>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pillsRow: {
    flexShrink: 0,
  },
  pillsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  pill: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonContainer: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  skeletonCard: {
    marginBottom: 0,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
  },
  separator: {
    height: theme.spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  errorTitle: {
    marginTop: theme.spacing.sm,
  },
  retryButton: {
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: theme.spacing.xl,
  },
})
