// Stub web de ItineraryMap — react-native-maps solo funciona en iOS/Android
// Metro resuelve este archivo automáticamente en web gracias a la extensión .web.tsx

import { View, Text } from 'react-native'
import type { ItineraryDay, ItineraryNode } from '@travelapp/types'

interface ItineraryMapProps {
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>
  displayTimezone?: string
  selectedDayIndex?: number
}

export const ItineraryMap = (_props: ItineraryMapProps) => (
  <View className="flex-1 items-center justify-center rounded-2xl bg-slate-800">
    <Text className="text-4xl">🗺️</Text>
    <Text className="mt-3 text-sm font-medium text-slate-300">
      Mapa disponible en la app móvil
    </Text>
    <Text className="mt-1 text-xs text-slate-500">
      iOS · Android
    </Text>
  </View>
)
