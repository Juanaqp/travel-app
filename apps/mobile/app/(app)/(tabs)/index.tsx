import { View, FlatList, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useTrips } from '@/hooks/useTrips'
import { TripCard } from '@/components/TripCard'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { Header } from '@/components/Header'
import { OfflineBanner } from '@/components/OfflineBanner'
import type { Trip } from '@travelapp/types'

// Tab Mis Viajes — lista principal de viajes del usuario
export default function HomeScreen() {
  const { data: trips, isLoading, error, refetch, isRefetching } = useTrips()

  const handleTripPress = (trip: Trip) => {
    router.push(`/(app)/trips/${trip.id}` as never)
  }

  const handleNewTrip = () => {
    router.push('/(app)/trips/new' as never)
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900">
        <Header title="Mis Viajes" />
        <View className="px-4 pt-4">
          <LoadingSkeleton count={3} height={200} />
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-900">
        <Header title="Mis Viajes" actionLabel="+ Nuevo" onAction={handleNewTrip} />
        <EmptyState
          title="No pudimos cargar tus viajes"
          subtitle="Comprueba tu conexión e inténtalo de nuevo"
          actionLabel="Reintentar"
          onAction={refetch}
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-slate-900">
      <OfflineBanner />
      <Header title="Mis Viajes" actionLabel="+ Nuevo" onAction={handleNewTrip} />

      <FlatList
        data={trips}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item }) => <TripCard trip={item} onPress={handleTripPress} />}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aún no tienes viajes"
            subtitle="Crea tu primer viaje y planifícalo con IA"
            actionLabel="Crear primer viaje"
            onAction={handleNewTrip}
          />
        }
      />
    </View>
  )
}
