import { ScrollView, View, Text } from 'react-native'
import type { ItineraryNode } from '@travelapp/types'

// Tipos de nodos que representan ubicaciones físicas visitables
const LOCATION_NODE_TYPES = new Set(['poi', 'restaurant', 'activity', 'hotel_checkin', 'flight'])

interface DayRouteCardProps {
  nodes: ItineraryNode[]
}

// Muestra la ruta del día como chips horizontales desplazables.
// Sustituye al mapa cuando no hay librería de mapas disponible.
export const DayRouteCard = ({ nodes }: DayRouteCardProps) => {
  const locationNodes = nodes.filter((n) => LOCATION_NODE_TYPES.has(n.type))

  if (locationNodes.length === 0) return null

  return (
    <View className="mb-3 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Ruta del día
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-center">
          {locationNodes.map((node, idx) => (
            <View key={node.id} className="flex-row items-center">
              <View className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1">
                <Text className="max-w-[120px] text-xs text-slate-300" numberOfLines={1}>
                  {node.emoji} {node.name}
                </Text>
              </View>
              {idx < locationNodes.length - 1 && (
                <Text className="mx-1.5 text-xs text-slate-600">→</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text className="mt-1.5 text-xs text-slate-600">
        {locationNodes.length} {locationNodes.length === 1 ? 'lugar' : 'lugares'}
      </Text>
    </View>
  )
}
