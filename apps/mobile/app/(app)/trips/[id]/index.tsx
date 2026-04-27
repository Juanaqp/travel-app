import { View, Text, ScrollView, Pressable, Image } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useTrip } from '@/hooks/useTrips'
import { useItinerary } from '@/hooks/useItinerary'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/Badge'
import type { Trip, TripStatus } from '@travelapp/types'

// ─── Etiquetas de estado ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<TripStatus, string> = {
  planning: 'Planificando',
  confirmed: 'Confirmado',
  active: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_BADGE_VARIANTS: Record<
  TripStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  planning: 'default',
  confirmed: 'info',
  active: 'success',
  completed: 'default',
  cancelled: 'danger',
}

// ─── Módulo del dashboard ─────────────────────────────────────────────────────

interface ModuleCardProps {
  emoji: string
  title: string
  subtitle: string
  onPress: () => void
  accessibilityLabel: string
}

const ModuleCard = ({ emoji, title, subtitle, onPress, accessibilityLabel }: ModuleCardProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    className="mb-3 flex-1 rounded-xl border border-slate-700 bg-slate-800 p-4 active:bg-slate-700"
  >
    <Text className="mb-2 text-3xl" accessibilityElementsHidden>
      {emoji}
    </Text>
    <Text className="text-sm font-semibold text-white">{title}</Text>
    <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={2}>
      {subtitle}
    </Text>
  </Pressable>
)

// ─── Header del viaje ─────────────────────────────────────────────────────────

interface TripHeaderProps {
  trip: Trip
}

const TripDetailHeader = ({ trip }: TripHeaderProps) => {
  const primaryDestination = trip.destinations[0]

  return (
    <View>
      {/* Imagen de portada */}
      <View className="h-56 bg-indigo-950">
        {trip.coverImageUrl ? (
          <Image
            source={{ uri: trip.coverImageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityLabel={`Foto de portada de ${trip.title}`}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-7xl" accessibilityElementsHidden>
              ✈️
            </Text>
          </View>
        )}

        {/* Botón de retroceso flotante */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver a Mis Viajes"
          className="absolute left-4 top-12 rounded-full bg-black/50 p-2"
        >
          <Text className="px-1 text-lg font-semibold text-white">←</Text>
        </Pressable>
      </View>

      {/* Datos principales del viaje */}
      <View className="bg-slate-900 px-4 py-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-bold text-white" numberOfLines={2}>
              {trip.title}
            </Text>
            {primaryDestination ? (
              <Text className="mt-1 text-sm text-slate-400">
                {primaryDestination.city}, {primaryDestination.country}
              </Text>
            ) : null}
          </View>
          <Badge
            label={STATUS_LABELS[trip.status]}
            variant={STATUS_BADGE_VARIANTS[trip.status]}
          />
        </View>

        {/* Fechas */}
        {trip.startDate ? (
          <View className="mt-3 flex-row gap-4">
            <View>
              <Text className="text-xs text-slate-500">Inicio</Text>
              <Text className="text-sm font-medium text-slate-300">{trip.startDate}</Text>
            </View>
            {trip.endDate ? (
              <View>
                <Text className="text-xs text-slate-500">Fin</Text>
                <Text className="text-sm font-medium text-slate-300">{trip.endDate}</Text>
              </View>
            ) : null}
            <View>
              <Text className="text-xs text-slate-500">Viajeros</Text>
              <Text className="text-sm font-medium text-slate-300">
                {trip.travelersCount} {trip.travelersCount === 1 ? 'persona' : 'personas'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: trip, isLoading, error, refetch } = useTrip(id ?? '')
  const { data: savedItinerary } = useItinerary(id ?? '')

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 pt-16">
        <LoadingSkeleton count={1} height={224} />
        <View className="px-4 pt-4">
          <LoadingSkeleton count={4} height={100} />
        </View>
      </View>
    )
  }

  if (error || !trip) {
    return (
      <View className="flex-1 bg-slate-900">
        <View className="px-4 pt-14">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Text className="text-indigo-400">← Volver</Text>
          </Pressable>
        </View>
        <EmptyState
          title="Viaje no encontrado"
          subtitle="No pudimos cargar los datos de este viaje"
          actionLabel="Reintentar"
          onAction={refetch}
        />
      </View>
    )
  }

  // Módulos del dashboard — se expandirán en fases posteriores
  const modules: ModuleCardProps[] = [
    {
      emoji: '🗺️',
      title: 'Itinerario',
      subtitle: savedItinerary
        ? `${savedItinerary.graph.meta.totalDays} días · ${savedItinerary.graph.meta.totalNodes} actividades`
        : 'Genera tu itinerario con IA',
      onPress: () =>
        savedItinerary
          ? router.push(`/(app)/trips/${id}/itinerary` as never)
          : router.push(`/(app)/trips/${id}/itinerary/generate` as never),
      accessibilityLabel: 'Módulo de itinerario del viaje',
    },
    {
      emoji: '📄',
      title: 'Documentos',
      subtitle: 'Pasaportes, visas y reservas',
      onPress: () => {},
      accessibilityLabel: 'Módulo de documentos del viaje',
    },
    {
      emoji: '💰',
      title: 'Gastos',
      subtitle: 'Control de presupuesto',
      onPress: () => {},
      accessibilityLabel: 'Módulo de gastos del viaje',
    },
    {
      emoji: '🌍',
      title: 'Mapa',
      subtitle:
        trip.destinations.length > 0
          ? `${trip.destinations.length} destino${trip.destinations.length > 1 ? 's' : ''}`
          : 'Sin destinos configurados',
      onPress: () => {},
      accessibilityLabel: 'Módulo de mapa del viaje',
    },
  ]

  return (
    <View className="flex-1 bg-slate-900">
      <ScrollView showsVerticalScrollIndicator={false}>
        <TripDetailHeader trip={trip} />

        {/* Grid de módulos */}
        <View className="px-4 pt-4 pb-8">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Módulos del viaje
          </Text>

          {/* Fila 1 */}
          <View className="mb-3 flex-row gap-3">
            <ModuleCard {...modules[0]!} />
            <ModuleCard {...modules[1]!} />
          </View>

          {/* Fila 2 */}
          <View className="flex-row gap-3">
            <ModuleCard {...modules[2]!} />
            <ModuleCard {...modules[3]!} />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
