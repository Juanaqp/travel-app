// Mapa del itinerario con pins por tipo de nodo y líneas de recorrido
// Usa react-native-maps (compatible con Expo SDK 52 sin EAS Build)

import { useRef, useMemo } from 'react'
import { View, Text, Platform, Pressable } from 'react-native'
import MapView, { Marker, Polyline, Callout, PROVIDER_DEFAULT } from 'react-native-maps'
import { formatNodeTime } from '@travelapp/types'
import type { ItineraryNode, ItineraryDay } from '@travelapp/types'

// ─── Colores por tipo de nodo ─────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  flight: '#6366F1',
  hotel_checkin: '#8B5CF6',
  restaurant: '#F59E0B',
  poi: '#10B981',
  activity: '#3B82F6',
  transport: '#64748B',
  free_time: '#EC4899',
  note: '#94A3B8',
}

const getNodeColor = (type: string): string => NODE_COLORS[type] ?? '#94A3B8'

// ─── Región inicial calculada a partir de los nodos con coordenadas ───────────

const computeRegion = (nodes: ItineraryNode[]) => {
  const withCoords = nodes.filter(
    (n) => n.location.lat != null && n.location.lng != null
  )

  if (withCoords.length === 0) {
    // Región por defecto (Madrid) si no hay coordenadas
    return { latitude: 40.416775, longitude: -3.70379, latitudeDelta: 0.1, longitudeDelta: 0.1 }
  }

  const lats = withCoords.map((n) => n.location.lat!)
  const lngs = withCoords.map((n) => n.location.lng!)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const padding = 0.05
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat + padding, 0.02),
    longitudeDelta: Math.max(maxLng - minLng + padding, 0.02),
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ItineraryMapProps {
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>
  displayTimezone?: string
  selectedDayIndex?: number
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const ItineraryMap = ({
  days,
  nodes,
  displayTimezone,
  selectedDayIndex,
}: ItineraryMapProps) => {
  const mapRef = useRef<MapView>(null)

  // Nodos del día seleccionado (o todos si no hay selección) con coordenadas
  const visibleNodes = useMemo(() => {
    const dayNodes =
      selectedDayIndex != null
        ? (days[selectedDayIndex]?.nodeIds ?? []).map((id) => nodes[id]).filter(Boolean)
        : Object.values(nodes)

    return (dayNodes as ItineraryNode[]).filter(
      (n) => n.userStatus !== 'rejected' && n.location.lat != null && n.location.lng != null
    )
  }, [days, nodes, selectedDayIndex])

  // Puntos del recorrido en orden para la polyline
  const polylineCoords = useMemo(
    () =>
      visibleNodes.map((n) => ({
        latitude: n.location.lat!,
        longitude: n.location.lng!,
      })),
    [visibleNodes]
  )

  const region = useMemo(() => computeRegion(visibleNodes), [visibleNodes])

  // react-native-maps no funciona en web (muestra placeholder)
  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 items-center justify-center bg-slate-800 rounded-2xl">
        <Text className="text-4xl mb-2">🗺️</Text>
        <Text className="text-slate-300 text-sm font-medium">Mapa disponible en iOS y Android</Text>
      </View>
    )
  }

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={{ flex: 1 }}
      initialRegion={region}
      showsUserLocation
      showsCompass
      userInterfaceStyle="dark"
    >
      {/* Línea de recorrido */}
      {polylineCoords.length > 1 && (
        <Polyline
          coordinates={polylineCoords}
          strokeColor="#6366F1"
          strokeWidth={2}
          lineDashPattern={[6, 4]}
        />
      )}

      {/* Pin por cada nodo con coordenadas */}
      {visibleNodes.map((node, idx) => (
        <Marker
          key={node.id}
          coordinate={{ latitude: node.location.lat!, longitude: node.location.lng! }}
          pinColor={getNodeColor(node.type)}
        >
          <View
            style={{ backgroundColor: getNodeColor(node.type) }}
            className="w-8 h-8 rounded-full items-center justify-center border-2 border-white"
          >
            <Text className="text-white text-xs font-bold">{idx + 1}</Text>
          </View>

          <Callout tooltip>
            <View className="bg-slate-800 rounded-xl p-3 border border-slate-600 min-w-48 max-w-64">
              <Text className="text-white font-semibold text-sm" numberOfLines={2}>
                {node.emoji} {node.name}
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {formatNodeTime(node, displayTimezone)}
                {node.durationMinutes > 0
                  ? ` · ${Math.round(node.durationMinutes / 60 * 10) / 10}h`
                  : ''}
              </Text>
              {node.location.address ? (
                <Text className="text-slate-500 text-xs mt-1" numberOfLines={2}>
                  📍 {node.location.address}
                </Text>
              ) : null}
              {node.cost.amount != null && node.cost.amount > 0 ? (
                <Text className="text-emerald-400 text-xs mt-1">
                  {node.cost.currency ?? '€'}{node.cost.amount}
                </Text>
              ) : null}
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  )
}
