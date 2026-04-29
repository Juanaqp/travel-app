import { View, Text } from 'react-native'
import type { ItineraryNode } from '@travelapp/types'

interface DaySummaryProps {
  nodes: ItineraryNode[]
  currency?: string
}

export const DaySummary = ({ nodes, currency = '€' }: DaySummaryProps) => {
  const activeNodes = nodes.filter((n) => n.userStatus !== 'rejected')

  const flightCount    = activeNodes.filter((n) => n.type === 'flight').length
  const activityCount  = activeNodes.filter((n) => ['activity', 'poi'].includes(n.type)).length
  const mealCount      = activeNodes.filter((n) => n.type === 'restaurant').length

  // Duración activa total: excluye free_time y note
  const totalMinutes   = activeNodes
    .filter((n) => !['free_time', 'note'].includes(n.type))
    .reduce((sum, n) => sum + n.durationMinutes, 0)

  const totalHours     = Math.floor(totalMinutes / 60)
  const remainingMins  = totalMinutes % 60

  const estimatedCost  = activeNodes
    .filter((n) => !n.cost.isIncluded && n.cost.amount !== undefined)
    .reduce((sum, n) => sum + (n.cost.amount ?? 0), 0)

  const durationLabel = totalHours > 0
    ? `${totalHours}h${remainingMins > 0 ? ` ${remainingMins}m` : ''}`
    : `${totalMinutes}m`

  return (
    <View className="mb-3 flex-row items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5">
      {flightCount > 0 ? (
        <View className="flex-row items-center gap-1">
          <Text className="text-sm">✈️</Text>
          <Text className="text-xs font-semibold text-blue-300">{flightCount}</Text>
        </View>
      ) : null}
      {activityCount > 0 ? (
        <View className="flex-row items-center gap-1">
          <Text className="text-sm">🎯</Text>
          <Text className="text-xs font-semibold text-green-300">{activityCount}</Text>
        </View>
      ) : null}
      {mealCount > 0 ? (
        <View className="flex-row items-center gap-1">
          <Text className="text-sm">🍽️</Text>
          <Text className="text-xs font-semibold text-amber-300">{mealCount}</Text>
        </View>
      ) : null}
      <View className="ml-auto flex-row items-center gap-3">
        <Text className="text-xs text-slate-400">⏱ {durationLabel}</Text>
        {estimatedCost > 0 ? (
          <Text className="text-xs font-semibold text-indigo-300">
            ~{currency} {Math.round(estimatedCost)}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
