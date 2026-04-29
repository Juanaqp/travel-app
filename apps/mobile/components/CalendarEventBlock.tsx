import { View, Text, Pressable } from 'react-native'
import { formatNodeTime, getDayOffset } from '@travelapp/types'
import type { ItineraryNode, FlightNode } from '@travelapp/types'

// Altura en píxeles que representa 1 minuto en la timeline
const MINUTES_PER_PIXEL = 1.5

// Colores por tipo de nodo
const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  flight:        { bg: 'bg-blue-900/60',   border: 'border-blue-500/50',   text: 'text-blue-300'   },
  hotel_checkin: { bg: 'bg-violet-900/60', border: 'border-violet-500/50', text: 'text-violet-300' },
  activity:      { bg: 'bg-green-900/60',  border: 'border-green-500/50',  text: 'text-green-300'  },
  restaurant:    { bg: 'bg-amber-900/60',  border: 'border-amber-500/50',  text: 'text-amber-300'  },
  transport:     { bg: 'bg-slate-700/60',  border: 'border-slate-500/50',  text: 'text-slate-300'  },
  poi:           { bg: 'bg-indigo-900/60', border: 'border-indigo-500/50', text: 'text-indigo-300' },
  free_time:     { bg: 'bg-teal-900/60',   border: 'border-teal-500/50',   text: 'text-teal-300'   },
  note:          { bg: 'bg-slate-800/60',  border: 'border-slate-600/50',  text: 'text-slate-400'  },
}

const getFallbackColor = () => NODE_COLORS.poi

interface CalendarEventBlockProps {
  node: ItineraryNode
  // Timezone activo para mostrar las horas
  displayTimezone: string
  // Timezone de origen para mostrar hora secundaria en vuelos
  originTimezone?: string
  onPress?: (node: ItineraryNode) => void
}

export const CalendarEventBlock = ({
  node,
  displayTimezone,
  originTimezone,
  onPress,
}: CalendarEventBlockProps) => {
  const colors = NODE_COLORS[node.type] ?? getFallbackColor()
  const height = Math.max(node.durationMinutes * MINUTES_PER_PIXEL, 36)

  const primaryTime = formatNodeTime(node, displayTimezone)

  // Para vuelos: mostrar hora llegada con posible offset de día
  let arrivalLabel: string | null = null
  let dayOffsetBadge: number = 0

  if (node.type === 'flight') {
    const flightNode = node as FlightNode
    if (flightNode.arrivalTime && node.isoTime && originTimezone) {
      // Calcular desfase de días entre origen y destino
      const arrivalIso = (flightNode as { arrivalIso?: string }).arrivalIso
      if (arrivalIso) {
        dayOffsetBadge = getDayOffset(arrivalIso, originTimezone, displayTimezone)
        arrivalLabel = formatNodeTime({ ...node, isoTime: arrivalIso }, displayTimezone)
      } else {
        arrivalLabel = flightNode.arrivalTime
      }
    }
  }

  // Hora secundaria: si el timezone activo difiere del timezone del nodo, mostrar la hora local del nodo
  let secondaryTimeLabel: string | null = null
  if (node.isoTime && node.timezone && node.timezone !== displayTimezone) {
    const localTime = formatNodeTime(node, node.timezone)
    const tzShortName = node.timezone.split('/').pop()?.replace('_', ' ') ?? node.timezone
    secondaryTimeLabel = `${localTime} hora ${tzShortName}`
  }

  return (
    <Pressable
      onPress={() => onPress?.(node)}
      style={{ height, minHeight: 36 }}
      className={`mb-1 overflow-hidden rounded-lg border px-2 py-1 ${colors.bg} ${colors.border}`}
      accessibilityRole="button"
      accessibilityLabel={`${node.name} a las ${primaryTime}`}
    >
      {/* Línea superior: hora + badge de día */}
      <View className="flex-row items-center gap-1">
        <Text className={`text-xs font-bold ${colors.text}`}>{primaryTime}</Text>
        {arrivalLabel ? (
          <>
            <Text className="text-xs text-slate-500"> → </Text>
            <Text className={`text-xs font-bold ${colors.text}`}>{arrivalLabel}</Text>
          </>
        ) : null}
        {dayOffsetBadge > 0 ? (
          <View className="ml-1 rounded bg-orange-500/80 px-1">
            <Text className="text-xs font-bold text-white">+{dayOffsetBadge} día</Text>
          </View>
        ) : null}
      </View>

      {/* Nombre del evento */}
      {height >= 48 ? (
        <Text className="mt-0.5 text-xs font-semibold text-white" numberOfLines={1}>
          {node.emoji} {node.name}
        </Text>
      ) : null}

      {/* Hora secundaria (timezone alternativo) */}
      {secondaryTimeLabel && height >= 60 ? (
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {secondaryTimeLabel}
        </Text>
      ) : null}
    </Pressable>
  )
}
