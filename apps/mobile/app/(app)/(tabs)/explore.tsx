import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useExploreFeed } from '@/hooks/useExploreFeed'
import { useAskAI } from '@/hooks/useAskAI'
import { useTrips } from '@/hooks/useTrips'
import { useAuthStore } from '@/stores/useAuthStore'
import { useExploreStore } from '@/stores/useExploreStore'
import { useToastStore } from '@/stores/useToastStore'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import type { ExploreDestination, Trip } from '@travelapp/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Retorna el primer viaje (useTrips ya filtra deleted_at y ordena por created_at DESC)
export const getActiveTrip = (trips: Trip[]): Trip | null => trips[0] ?? null

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface DestinationCardProps {
  destination: ExploreDestination
  onPress: () => void
}

const DestinationCard = ({ destination, onPress }: DestinationCardProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Ver destino ${destination.name}`}
    className="mr-3 overflow-hidden rounded-2xl active:opacity-80"
    style={{ width: 160, height: 200 }}
  >
    <ImageBackground
      source={{ uri: destination.image_url }}
      style={{ width: 160, height: 200 }}
      resizeMode="cover"
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          padding: 12,
          backgroundColor: 'rgba(0,0,0,0.42)',
        }}
      >
        <Text className="text-base font-bold text-white" numberOfLines={1}>
          {destination.name}
        </Text>
        {destination.trip_count > 0 && (
          <Text className="mt-0.5 text-xs text-slate-300">
            {destination.trip_count}{' '}
            {destination.trip_count === 1 ? 'viajero lo exploró' : 'viajeros lo exploraron'}
          </Text>
        )}
      </View>
    </ImageBackground>
  </Pressable>
)

const DestinationCardSkeleton = ({ count }: { count: number }) => (
  <View className="flex-row">
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} className="mr-3 rounded-2xl bg-slate-700" style={{ width: 160, height: 200 }} />
    ))}
  </View>
)

interface QuickAccessButtonProps {
  emoji: string
  label: string
  onPress: () => void
}

const QuickAccessButton = ({ emoji, label, onPress }: QuickAccessButtonProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    className="flex-1 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 p-4 active:bg-slate-700"
    style={{ minHeight: 90 }}
  >
    <Text className="mb-1 text-2xl" accessibilityElementsHidden>
      {emoji}
    </Text>
    <Text className="text-center text-xs font-medium text-slate-300">{label}</Text>
  </Pressable>
)

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const { destinations, isLoading: feedLoading } = useExploreFeed()
  const { search, status: askStatus } = useAskAI()
  const { data: tripsData } = useTrips()
  const trips = tripsData ?? []
  const { user } = useAuthStore()
  const { setActiveTrip } = useExploreStore()
  const showToast = useToastStore.getState().showToast

  const activeTrip = getActiveTrip(trips)
  const isSearching = askStatus === 'loading'

  // Sincronizar el viaje activo en el store cuando cambia la lista de viajes
  useEffect(() => {
    setActiveTrip(activeTrip)
  }, [activeTrip, setActiveTrip])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    if (!user) {
      showToast('Inicia sesión para buscar', 'warning')
      router.push('/(auth)' as never)
      return
    }

    const result = await search(searchQuery.trim())
    if (result) {
      router.push(
        `/(app)/explore/destination/${encodeURIComponent(searchQuery.trim())}` as never
      )
    }
  }

  const handleDestinationPress = (name: string) => {
    router.push(`/(app)/explore/destination/${encodeURIComponent(name)}` as never)
  }

  const requireActiveTrip = (label: string, onHasTrip: (trip: Trip) => void) => {
    if (!activeTrip) {
      Alert.alert(
        'Sin viaje activo',
        `Para ${label} necesitas tener un viaje creado primero.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Crear viaje', onPress: () => router.push('/(app)/trips/new' as never) },
        ]
      )
      return
    }
    onHasTrip(activeTrip)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-4 pb-2 pt-14">
          <Text className="text-2xl font-bold text-white">Explorar</Text>
          <Text className="mt-1 text-sm text-slate-400">Descubre tu próximo destino</Text>
        </View>

        {/* ── SECCIÓN 1: Buscador de inspiración ── */}
        <View className="mx-4 mt-4 rounded-2xl bg-slate-800 p-4">
          <Text className="mb-3 text-base font-semibold text-white">¿A dónde quieres ir?</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-xl bg-slate-700 px-3">
              <Text className="mr-2 text-slate-400" accessibilityElementsHidden>
                🔍
              </Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Roma, Tokio, Bali..."
                placeholderTextColor="#94a3b8"
                className="flex-1 py-3 text-white"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                accessibilityLabel="Buscar destino"
              />
            </View>
            <Pressable
              onPress={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              accessibilityRole="button"
              accessibilityLabel="Buscar"
              className="rounded-xl bg-indigo-500 px-4 py-3 active:bg-indigo-600"
              style={{ opacity: isSearching || !searchQuery.trim() ? 0.5 : 1 }}
            >
              <Text className="font-semibold text-white">
                {isSearching ? '...' : 'Buscar'}
              </Text>
            </Pressable>
          </View>
          {isSearching && (
            <View className="mt-3">
              <LoadingSkeleton count={1} height={48} />
            </View>
          )}
        </View>

        {/* ── SECCIÓN 2: Destinos populares ── */}
        <View className="mt-6">
          <Text className="mx-4 mb-3 text-lg font-bold text-white">Destinos populares</Text>

          {feedLoading ? (
            <View className="pl-4">
              <DestinationCardSkeleton count={3} />
            </View>
          ) : destinations.length === 0 ? (
            <View className="mx-4">
              <EmptyState
                title="Sé el primero en explorar"
                subtitle="Aún no hay destinos populares. ¡Crea tu primer viaje!"
                actionLabel="Crear viaje"
                onAction={() => router.push('/(app)/trips/new' as never)}
              />
            </View>
          ) : (
            <FlatList
              data={destinations}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <DestinationCard
                  destination={item}
                  onPress={() => handleDestinationPress(item.name)}
                />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          )}
        </View>

        {/* ── SECCIÓN 3: Empieza rápido ── */}
        <View className="mx-4 mt-6">
          <Text className="mb-3 text-lg font-bold text-white">Empieza rápido</Text>
          <View className="flex-row gap-3">
            <QuickAccessButton
              emoji="✈️"
              label="Nuevo viaje"
              onPress={() => router.push('/(app)/trips/new' as never)}
            />
            <QuickAccessButton
              emoji="📄"
              label="Escanear documento"
              onPress={() =>
                requireActiveTrip('escanear documentos', (trip) =>
                  router.push(`/(app)/trips/${trip.id}/documents` as never)
                )
              }
            />
          </View>
          <View className="mt-3 flex-row gap-3">
            <QuickAccessButton
              emoji="💸"
              label="Registrar gasto"
              onPress={() =>
                requireActiveTrip('registrar un gasto', (trip) =>
                  router.push(`/(app)/trips/${trip.id}/expenses/new` as never)
                )
              }
            />
            <QuickAccessButton
              emoji="🗺️"
              label="Mis mapas"
              onPress={() =>
                requireActiveTrip('ver el mapa', (trip) =>
                  router.push(`/(app)/trips/${trip.id}/itinerary/map` as never)
                )
              }
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
