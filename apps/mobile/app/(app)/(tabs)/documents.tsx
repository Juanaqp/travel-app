import { useState, useEffect } from 'react'
import { View, SectionList, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { DocumentCard } from '@/components/DocumentCard'
import { useTrips } from '@/hooks/useTrips'
import { useDocuments } from '@/hooks/useDocuments'
import { getDocumentsOffline } from '@/lib/offline/reader'
import type { Trip, TravelDocument } from '@travelapp/types'

// ─── Construcción de secciones ────────────────────────────────────────────────

interface TripDocumentSection {
  tripId: string
  tripTitle: string
  destLabel: string
  data: TravelDocument[]
}

const buildSections = (trips: Trip[], docs: TravelDocument[]): TripDocumentSection[] => {
  const byTrip: Record<string, TravelDocument[]> = {}
  for (const doc of docs) {
    if (!doc.tripId) continue
    if (!byTrip[doc.tripId]) byTrip[doc.tripId] = []
    byTrip[doc.tripId].push(doc)
  }

  return trips
    .filter((t) => (byTrip[t.id]?.length ?? 0) > 0)
    .map((trip) => {
      const firstDest = trip.destinations?.[0]
      const destLabel = firstDest
        ? `${firstDest.city}${firstDest.country ? ', ' + firstDest.country : ''}`
        : ''
      return {
        tripId: trip.id,
        tripTitle: trip.title,
        destLabel,
        data: byTrip[trip.id],
      }
    })
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function DocumentsTabScreen() {
  const { colors } = useTheme()
  const { data: trips, isLoading: tripsLoading, error: tripsError, refetch: refetchTrips } = useTrips()
  const { data: docs, isLoading: docsLoading, error: docsError, refetch: refetchDocs } = useDocuments()
  const [offlineDocs, setOfflineDocs] = useState<TravelDocument[] | null>(null)

  // Cargar desde caché offline cuando la red falla
  useEffect(() => {
    if (!docsError || !trips?.length) return
    Promise.all(trips.map((trip) => getDocumentsOffline(trip.id)))
      .then((results) => setOfflineDocs(results.flat() as TravelDocument[]))
      .catch(() => setOfflineDocs([]))
  }, [docsError, trips])

  const isLoading = tripsLoading || (docsLoading && offlineDocs === null)
  const isOffline = !!docsError && offlineDocs !== null

  const refetchAll = () => {
    setOfflineDocs(null)
    refetchTrips()
    refetchDocs()
  }

  const activeDocs = docs ?? offlineDocs ?? []
  const sections = buildSections(trips ?? [], activeDocs)

  if (isLoading) {
    return (
      <ScreenWrapper header={{ title: 'Documentos', large: true }} padding={false}>
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
        </View>
      </ScreenWrapper>
    )
  }

  // Error de red sin caché disponible
  if (tripsError) {
    return (
      <ScreenWrapper header={{ title: 'Documentos', large: true }} padding={false}>
        <View style={styles.emptyContainer}>
          <Icon name="offline" size="xl" color={colors.text.tertiary} />
          <Text variant="subheading" weight="semibold" color={colors.text.primary} align="center">
            Error al cargar documentos
          </Text>
          <Pressable
            onPress={refetchAll}
            style={[styles.emptyAction, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text variant="body" weight="semibold" color="#FFFFFF">
              Reintentar
            </Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    )
  }

  // Estado vacío
  if (!sections.length) {
    return (
      <ScreenWrapper header={{ title: 'Documentos', large: true }} padding={false}>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}12` }]}>
            <Icon name="passport" size="xl" color={colors.primary} />
          </View>
          <Text variant="subheading" weight="semibold" color={colors.text.primary} align="center">
            No documents yet
          </Text>
          <Text
            variant="body"
            color={colors.text.secondary}
            align="center"
            style={styles.emptySubtitle}
          >
            Upload documents from inside a trip
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/(tabs)' as never)}
            style={[styles.emptyAction, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Ver mis viajes"
          >
            <Text variant="body" weight="semibold" color="#FFFFFF">
              Ver mis viajes
            </Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper
      header={{
        title: 'Documentos',
        large: true,
        subtitle: isOffline
          ? 'Sin conexión — caché local'
          : `${activeDocs.length} documento${activeDocs.length !== 1 ? 's' : ''}`,
      }}
      padding={false}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Pressable
            onPress={() => router.push(`/(app)/trips/${section.tripId}/documents` as never)}
            accessibilityRole="button"
            accessibilityLabel={`Ver documentos del viaje ${section.tripTitle}`}
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.background.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text variant="body" weight="semibold" color={colors.text.primary} numberOfLines={1}>
                {section.tripTitle}
              </Text>
              {section.destLabel ? (
                <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                  {section.destLabel}
                </Text>
              ) : null}
            </View>
            <View style={[styles.docCountBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text style={[styles.docCountText, { color: colors.primary }]}>
                {section.data.length}
              </Text>
            </View>
            <Icon name="forward" size="sm" color={colors.text.tertiary} />
          </Pressable>
        )}
        renderSectionFooter={() => <View style={styles.sectionGap} />}
        renderItem={({ item, section }) => (
          <View style={styles.cardWrapper}>
            <DocumentCard
              document={item}
              onPress={() => router.push(`/(app)/trips/${section.tripId}/documents` as never)}
            />
          </View>
        )}
      />
    </ScreenWrapper>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40,
  },
  cardWrapper: {
    marginHorizontal: theme.spacing.md,
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  docCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  docCountText: {
    fontSize: theme.typography.size.xs,
    fontWeight: '700',
  },
  sectionGap: {
    height: theme.spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubtitle: {
    marginTop: -theme.spacing.xs,
  },
  emptyAction: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
  },
})
