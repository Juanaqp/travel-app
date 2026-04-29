// Tab Documentos — muestra todos los documentos del usuario agrupados por viaje.
// Permite encontrar cualquier documento sin tener que navegar a un viaje específico primero.

import { useState, useEffect } from 'react'
import { View, Text, SectionList, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useTrips } from '@/hooks/useTrips'
import { useDocuments } from '@/hooks/useDocuments'
import { getDocumentsOffline } from '@/lib/offline/reader'
import { DocumentCard } from '@/components/DocumentCard'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import type { Trip, TravelDocument } from '@travelapp/types'

// ─── Construcción de secciones ────────────────────────────────────────────────

interface TripDocumentSection {
  tripId: string
  title: string     // nombre del viaje + primer destino para el header
  data: TravelDocument[]
}

const buildSections = (trips: Trip[], docs: TravelDocument[]): TripDocumentSection[] => {
  // Agrupar documentos por tripId
  const byTrip: Record<string, TravelDocument[]> = {}
  for (const doc of docs) {
    if (!doc.tripId) continue
    if (!byTrip[doc.tripId]) byTrip[doc.tripId] = []
    byTrip[doc.tripId].push(doc)
  }

  // Construir secciones solo para viajes con documentos, respetando el orden de la lista
  return trips
    .filter((t) => (byTrip[t.id]?.length ?? 0) > 0)
    .map((trip) => {
      const firstDest = trip.destinations?.[0]
      const destLabel = firstDest
        ? `${firstDest.city}${firstDest.country ? ', ' + firstDest.country : ''}`
        : ''
      return {
        tripId: trip.id,
        title: destLabel ? `${trip.title} · ${destLabel}` : trip.title,
        data: byTrip[trip.id],
      }
    })
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function DocumentsTabScreen() {
  const { data: trips, isLoading: tripsLoading, error: tripsError, refetch: refetchTrips } = useTrips()
  const { data: docs, isLoading: docsLoading, error: docsError, refetch: refetchDocs } = useDocuments()

  // Documentos cargados desde caché offline cuando la red falla.
  // Mismo patrón que fetchDocuments(tripId) en useDocuments: llama getDocumentsOffline
  // por cada viaje y fusiona los resultados.
  const [offlineDocs, setOfflineDocs] = useState<TravelDocument[] | null>(null)

  useEffect(() => {
    if (!docsError || !trips?.length) return

    Promise.all(trips.map((trip) => getDocumentsOffline(trip.id)))
      .then((results) => {
        setOfflineDocs(results.flat() as TravelDocument[])
      })
      .catch(() => {
        setOfflineDocs([])
      })
  }, [docsError, trips])

  const isLoading = tripsLoading || (docsLoading && offlineDocs === null)
  const isOffline = !!docsError && offlineDocs !== null

  const refetchAll = () => {
    setOfflineDocs(null)
    refetchTrips()
    refetchDocs()
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 pt-16">
        <View className="px-4">
          <LoadingSkeleton count={3} height={120} />
        </View>
      </View>
    )
  }

  if (tripsError) {
    return (
      <View className="flex-1 bg-slate-900">
        <EmptyState
          title="Error al cargar documentos"
          subtitle="No pudimos cargar tus documentos"
          actionLabel="Reintentar"
          onAction={refetchAll}
        />
      </View>
    )
  }

  const activeDocs = docs ?? offlineDocs ?? []
  const sections = buildSections(trips ?? [], activeDocs)

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-4 pb-3 pt-14">
        <Text className="text-2xl font-bold text-white">Documentos</Text>
        {isOffline ? (
          <Text className="mt-1 text-xs text-amber-400">Sin conexión — mostrando caché local</Text>
        ) : (
          <Text className="mt-1 text-sm text-slate-400">
            {activeDocs.length > 0
              ? `${activeDocs.length} documento${activeDocs.length !== 1 ? 's' : ''}`
              : 'Todos tus documentos de viaje'}
          </Text>
        )}
      </View>

      {/* Estado vacío */}
      {!sections.length ? (
        <EmptyState
          title="Sin documentos"
          subtitle="Sube documentos desde cada viaje"
          actionLabel="Ver mis viajes"
          onAction={() => router.push('/(app)/(tabs)' as never)}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={() => router.push(`/(app)/trips/${section.tripId}/documents` as never)}
              accessibilityRole="button"
              accessibilityLabel={`Ver todos los documentos del viaje ${section.title}`}
            >
              <View className="mb-2 mt-4 flex-row items-center justify-between">
                <Text
                  className="flex-1 pr-2 text-sm font-semibold text-slate-300"
                  numberOfLines={1}
                >
                  {section.title}
                </Text>
                <Text className="text-xs text-indigo-400">Ver todos →</Text>
              </View>
            </Pressable>
          )}
          renderItem={({ item, section }) => (
            <Pressable
              onPress={() => router.push(`/(app)/trips/${section.tripId}/documents` as never)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir documentos del viaje ${section.title}`}
            >
              <DocumentCard document={item} />
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
