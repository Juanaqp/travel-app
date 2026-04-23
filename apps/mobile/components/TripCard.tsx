import { View, Text, Pressable, Image } from 'react-native'
import type { Trip, TripStatus } from '@travelapp/types'
import { Badge } from './Badge'

interface TripCardProps {
  trip: Trip
  onPress: (trip: Trip) => void
}

// Etiquetas visibles del estado del viaje
const STATUS_LABELS: Record<TripStatus, string> = {
  planning: 'Planificando',
  confirmed: 'Confirmado',
  active: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

// Variante de color del Badge por estado
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

// Formatea 'YYYY-MM-DD' como '12 abr 2026' sin librerías externas
const formatShortDate = (dateStr: string): string => {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '1', 10)
  const day = parseInt(parts[2] ?? '1', 10)
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`
}

// Calcula la leyenda dinámica de días según estado y fechas
const buildDaysLabel = (trip: Trip): string => {
  if (!trip.startDate) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(trip.startDate)

  if (trip.status === 'active' && trip.endDate) {
    const end = new Date(trip.endDate)
    const remaining = Math.ceil((end.getTime() - today.getTime()) / 864e5)
    if (remaining > 1) return `${remaining} días restantes`
    if (remaining === 1) return 'Último día'
    return 'Viaje finalizado'
  }

  if (trip.status === 'planning' || trip.status === 'confirmed') {
    const daysToGo = Math.ceil((start.getTime() - today.getTime()) / 864e5)
    if (daysToGo > 1) return `En ${daysToGo} días`
    if (daysToGo === 1) return 'Mañana'
    if (daysToGo === 0) return '¡Hoy!'
  }

  return ''
}

export const TripCard = ({ trip, onPress }: TripCardProps) => {
  const primaryDestination = trip.destinations[0]
  const daysLabel = buildDaysLabel(trip)

  return (
    <Pressable
      onPress={() => onPress(trip)}
      accessibilityRole="button"
      accessibilityLabel={`Viaje a ${primaryDestination?.city ?? trip.title}, estado: ${STATUS_LABELS[trip.status]}`}
      className="mb-4 overflow-hidden rounded-2xl bg-slate-800 active:opacity-75"
    >
      {/* Imagen de portada — placeholder si no hay URL */}
      <View className="relative h-44 bg-slate-700">
        {trip.coverImageUrl ? (
          <Image
            source={{ uri: trip.coverImageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityLabel={`Foto de portada de ${trip.title}`}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-indigo-950">
            <Text className="text-6xl" accessibilityElementsHidden>
              ✈️
            </Text>
          </View>
        )}

        {/* Badge de estado flotante sobre la imagen */}
        <View className="absolute right-3 top-3">
          <Badge
            label={STATUS_LABELS[trip.status]}
            variant={STATUS_BADGE_VARIANTS[trip.status]}
          />
        </View>
      </View>

      {/* Contenido de texto */}
      <View className="p-4">
        <Text className="text-lg font-bold text-white" numberOfLines={1}>
          {trip.title}
        </Text>

        {primaryDestination ? (
          <Text className="mt-0.5 text-sm text-slate-400">
            {primaryDestination.city}, {primaryDestination.country}
          </Text>
        ) : null}

        {/* Fechas y leyenda de días */}
        <View className="mt-2 flex-row items-center justify-between">
          {trip.startDate ? (
            <Text className="text-xs text-slate-500">
              {formatShortDate(trip.startDate)}
              {trip.endDate ? ` → ${formatShortDate(trip.endDate)}` : ''}
            </Text>
          ) : (
            <Text className="text-xs text-slate-600">Sin fechas definidas</Text>
          )}

          {daysLabel ? (
            <Text className="text-xs font-semibold text-indigo-400">{daysLabel}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}
