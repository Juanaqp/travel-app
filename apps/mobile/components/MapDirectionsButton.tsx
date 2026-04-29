// Botón que abre Google Maps / Apple Maps con las coordenadas de un nodo

import { Pressable, Text, Linking, Platform } from 'react-native'
import { logger } from '@/lib/logger'
import type { ItineraryNode } from '@travelapp/types'

interface MapDirectionsButtonProps {
  node: ItineraryNode
  label?: string
  className?: string
}

// Construye la URL de navegación según la plataforma
const buildDirectionsUrl = (node: ItineraryNode): string | null => {
  const { lat, lng, address, placeId } = node.location

  if (lat != null && lng != null) {
    if (Platform.OS === 'ios') {
      // Apple Maps en iOS
      const query = address ? encodeURIComponent(address) : `${lat},${lng}`
      return `maps://?q=${query}&ll=${lat},${lng}&dirflg=d`
    }
    // Google Maps en Android y web
    const dest = placeId
      ? `place_id:${placeId}`
      : `${lat},${lng}`
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
  }

  if (address) {
    const encoded = encodeURIComponent(address)
    if (Platform.OS === 'ios') return `maps://?q=${encoded}`
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`
  }

  return null
}

export const MapDirectionsButton = ({
  node,
  label = 'Cómo llegar',
  className = '',
}: MapDirectionsButtonProps) => {
  const handlePress = async () => {
    const url = buildDirectionsUrl(node)
    if (!url) return

    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        // Fallback a Google Maps web si la app nativa no está disponible
        const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(node.name)}`
        await Linking.openURL(fallback)
      }
    } catch (error) {
      logger.error('Error al abrir mapa de navegación', { error, nodeId: node.id })
    }
  }

  const hasLocation = node.location.lat != null || node.location.address

  if (!hasLocation) return null

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={`${label} a ${node.name}`}
      className={`flex-row items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 active:bg-indigo-700 ${className}`}
    >
      <Text className="text-sm">🗺️</Text>
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </Pressable>
  )
}
