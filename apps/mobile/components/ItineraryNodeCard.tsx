import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import type { ItineraryNode, TransportNode } from '@travelapp/types'

// ─── Helpers de presentación ──────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<ItineraryNode['type'], string> = {
  poi: 'Lugar',
  restaurant: 'Restaurante',
  transport: 'Transporte',
  hotel_checkin: 'Hotel',
  activity: 'Actividad',
  free_time: 'Tiempo libre',
  note: 'Nota',
  flight: 'Vuelo',
}

const TRANSPORT_MODE_EMOJIS: Record<
  NonNullable<TransportNode['transportMode']>,
  string
> = {
  metro: '🚇',
  bus: '🚌',
  taxi: '🚕',
  walking: '🚶',
  ferry: '⛴️',
  train: '🚂',
  car: '🚗',
}

// Clases de borde según el estado de revisión del usuario
const STATUS_BORDER_CLASS: Record<ItineraryNode['userStatus'], string> = {
  pending: 'border-slate-700',
  approved: 'border-green-700',
  rejected: 'border-red-800',
  modified: 'border-amber-700',
}

const STATUS_BG_CLASS: Record<ItineraryNode['userStatus'], string> = {
  pending: 'bg-slate-800',
  approved: 'bg-green-950/50',
  rejected: 'bg-red-950/40',
  modified: 'bg-amber-950/30',
}

// ─── TransferBadge — renderizado compacto para nodos de transporte ────────────

interface TransferBadgeProps {
  node: TransportNode
}

export const TransferBadge = ({ node }: TransferBadgeProps) => {
  const modeEmoji =
    node.transportMode ? (TRANSPORT_MODE_EMOJIS[node.transportMode] ?? '🚶') : '🚶'

  return (
    <View className="flex-row items-center py-1">
      <View className="h-px flex-1 bg-slate-700" />
      <View className="mx-3 flex-row items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
        <Text className="text-sm" accessibilityElementsHidden>
          {modeEmoji}
        </Text>
        {node.fromLocation && node.toLocation ? (
          <Text className="max-w-[160px] text-xs text-slate-400" numberOfLines={1}>
            → {node.toLocation}
          </Text>
        ) : null}
        {node.durationMinutes ? (
          <Text className="text-xs text-slate-500">{node.durationMinutes} min</Text>
        ) : null}
      </View>
      <View className="h-px flex-1 bg-slate-700" />
    </View>
  )
}

// ─── ItineraryNodeCard ────────────────────────────────────────────────────────

interface ItineraryNodeCardProps {
  node: ItineraryNode
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
}

export const ItineraryNodeCard = ({
  node,
  onApprove,
  onReject,
  onEdit,
}: ItineraryNodeCardProps) => {
  const [isTipExpanded, setIsTipExpanded] = useState(false)

  const isRejected = node.userStatus === 'rejected'
  const borderClass = STATUS_BORDER_CLASS[node.userStatus]
  const bgClass = STATUS_BG_CLASS[node.userStatus]

  // Costo formateado
  const costLabel =
    node.cost.amount !== undefined
      ? node.cost.isIncluded
        ? 'Incluido'
        : `${node.cost.currency ?? '€'} ${node.cost.amount}`
      : null

  return (
    <View
      className={`rounded-xl border p-4 ${borderClass} ${bgClass} ${isRejected ? 'opacity-50' : 'opacity-100'}`}
    >
      {/* Cabecera: emoji + nombre + hora */}
      <View className="flex-row items-start gap-3">
        <Text className="text-2xl" accessibilityElementsHidden>
          {node.emoji}
        </Text>
        <View className="flex-1">
          <Text
            className={`font-semibold text-white ${isRejected ? 'line-through' : ''}`}
            numberOfLines={2}
          >
            {node.name}
          </Text>
          <View className="mt-1 flex-row items-center gap-3">
            <Text className="text-xs text-slate-400">
              🕐 {node.time}
            </Text>
            <Text className="text-xs text-slate-500">
              {node.durationMinutes} min
            </Text>
          </View>
        </View>

        {/* Badges de tipo y costo */}
        <View className="items-end gap-1">
          <View className="rounded-md bg-slate-700 px-2 py-0.5">
            <Text className="text-xs text-slate-300">
              {NODE_TYPE_LABELS[node.type]}
            </Text>
          </View>
          {costLabel ? (
            <View className="rounded-md bg-indigo-900/60 px-2 py-0.5">
              <Text className="text-xs text-indigo-300">{costLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Descripción */}
      {node.description ? (
        <Text className="mt-2 text-sm text-slate-400" numberOfLines={2}>
          {node.description}
        </Text>
      ) : null}

      {/* aiTip colapsable */}
      {node.aiTip ? (
        <View className="mt-3 rounded-lg bg-indigo-950/60 px-3 py-2">
          <Pressable
            onPress={() => setIsTipExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isTipExpanded ? 'Ocultar consejo' : 'Ver consejo'}
          >
            <Text className="text-xs font-semibold text-indigo-300">
              💡 {isTipExpanded ? 'Ocultar consejo' : 'Ver consejo'}
            </Text>
          </Pressable>
          {isTipExpanded ? (
            <Text className="mt-1.5 text-xs leading-5 text-indigo-200/80">
              {node.aiTip}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Indicador de modificado por el usuario */}
      {node.isUserModified ? (
        <Text className="mt-2 text-xs text-amber-500">✏️ Modificado por ti</Text>
      ) : null}

      {/* Botones de acción */}
      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={onApprove}
          accessibilityRole="button"
          accessibilityLabel="Aprobar actividad"
          className={`flex-1 items-center rounded-lg py-2 ${
            node.userStatus === 'approved'
              ? 'bg-green-700'
              : 'bg-slate-700 active:bg-green-900'
          }`}
        >
          <Text className="text-xs font-semibold text-white">✓ Aprobar</Text>
        </Pressable>

        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Editar actividad"
          className="flex-1 items-center rounded-lg bg-slate-700 py-2 active:bg-slate-600"
        >
          <Text className="text-xs font-semibold text-white">✏️ Editar</Text>
        </Pressable>

        <Pressable
          onPress={onReject}
          accessibilityRole="button"
          accessibilityLabel="Eliminar actividad del itinerario"
          className={`flex-1 items-center rounded-lg py-2 ${
            node.userStatus === 'rejected'
              ? 'bg-red-800'
              : 'bg-slate-700 active:bg-red-900'
          }`}
        >
          <Text className="text-xs font-semibold text-white">✕ Quitar</Text>
        </Pressable>
      </View>
    </View>
  )
}
