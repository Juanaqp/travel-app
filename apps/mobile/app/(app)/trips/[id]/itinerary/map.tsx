// Pantalla de mapa del itinerario
// Muestra los nodos del itinerario como pins en el mapa con polyline del recorrido.
// Permite filtrar por día y alternar el timezone de visualización.

import { useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useItinerary } from '@/hooks/useItinerary'
import { useTimezoneStore } from '@/stores/useTimezoneStore'
import { ItineraryMap } from '@/components/ItineraryMap'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

export default function ItineraryMapScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const { data: itinerary, isLoading, error } = useItinerary(tripId ?? '')
  const { activeTimezone } = useTimezoneStore()
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 pt-16">
        <View className="px-4">
          <LoadingSkeleton count={2} height={48} />
        </View>
        <View className="flex-1 mt-4 mx-4 rounded-2xl overflow-hidden">
          <LoadingSkeleton count={1} height={400} />
        </View>
      </View>
    )
  }

  if (error || !itinerary) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="mb-2 text-base font-bold text-white">No se pudo cargar el mapa</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 rounded-xl bg-slate-700 px-5 py-2.5"
        >
          <Text className="font-semibold text-white">← Volver</Text>
        </Pressable>
      </View>
    )
  }

  const { graph } = itinerary
  const displayTz = activeTimezone ?? graph.destinationTimezone ?? 'UTC'

  // Cuenta los nodos con coordenadas
  const nodesWithCoords = Object.values(graph.nodes).filter(
    (n) => n.location.lat != null && n.location.lng != null
  ).length

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center border-b border-slate-700 px-4 pb-3 pt-12">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="mr-3 rounded-lg p-1 active:bg-slate-800"
        >
          <Text className="text-2xl text-slate-400">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-white">Mapa del itinerario</Text>
          <Text className="text-xs text-slate-500">
            {nodesWithCoords} lugar{nodesWithCoords !== 1 ? 'es' : ''} mapeado{nodesWithCoords !== 1 ? 's' : ''}
          </Text>
        </View>
        <View className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1">
          <Text className="text-xs text-slate-400">
            {displayTz.split('/').pop()?.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {/* Filtro por día */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-slate-700"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
      >
        {/* Opción "Todos los días" */}
        <Pressable
          onPress={() => setSelectedDayIndex(null)}
          className={`rounded-xl border px-3 py-1.5 ${
            selectedDayIndex === null
              ? 'border-indigo-500 bg-indigo-950'
              : 'border-slate-700 bg-slate-800'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              selectedDayIndex === null ? 'text-indigo-300' : 'text-slate-400'
            }`}
          >
            Todos
          </Text>
        </Pressable>

        {graph.days.map((day, idx) => (
          <Pressable
            key={day.id}
            onPress={() => setSelectedDayIndex(idx)}
            className={`rounded-xl border px-3 py-1.5 ${
              selectedDayIndex === idx
                ? 'border-indigo-500 bg-indigo-950'
                : 'border-slate-700 bg-slate-800'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                selectedDayIndex === idx ? 'text-indigo-300' : 'text-slate-400'
              }`}
            >
              Día {day.dayNumber}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Mapa */}
      <View className="flex-1">
        <ItineraryMap
          days={graph.days}
          nodes={graph.nodes}
          displayTimezone={displayTz}
          selectedDayIndex={selectedDayIndex ?? undefined}
        />
      </View>
    </View>
  )
}
