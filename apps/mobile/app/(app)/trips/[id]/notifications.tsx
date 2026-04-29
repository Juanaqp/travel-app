// Pantalla de gestión de notificaciones del viaje
// Permite al usuario ver las notificaciones programadas y activar/desactivar tipos.

import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, Switch, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useTrip } from '@/hooks/useTrips'
import { useItinerary } from '@/hooks/useItinerary'
import {
  requestPermissions,
  scheduleCheckinReminder,
  scheduleAirportReminder,
  scheduleDailySummary,
  cancelAllTripNotifications,
} from '@/lib/notifications'
import { logger } from '@/lib/logger'
import type { FlightNode } from '@travelapp/types'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface NotifPreferences {
  checkinReminder: boolean
  airportReminder: boolean
  dailySummary: boolean
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function TripNotificationsScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const { data: trip } = useTrip(tripId ?? '')
  const { data: itinerary } = useItinerary(tripId ?? '')

  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [prefs, setPrefs] = useState<NotifPreferences>({
    checkinReminder: true,
    airportReminder: true,
    dailySummary: true,
  })
  const [isScheduling, setIsScheduling] = useState(false)

  useEffect(() => {
    requestPermissions().then(setHasPermission)
  }, [])

  // Nodos de vuelo del itinerario aprobado
  const flightNodes = itinerary
    ? Object.values(itinerary.graph.nodes).filter(
        (n): n is FlightNode => n.type === 'flight' && n.userStatus !== 'rejected'
      )
    : []

  const destinationTz = itinerary?.graph.destinationTimezone ?? 'UTC'

  const handleRequestPermission = async () => {
    const granted = await requestPermissions()
    setHasPermission(granted)
    if (!granted) {
      Alert.alert(
        'Permisos requeridos',
        'Activa las notificaciones en Ajustes para recibir recordatorios de tu viaje.',
        [{ text: 'Entendido' }]
      )
    }
  }

  const handleScheduleAll = async () => {
    if (!tripId || !itinerary) return
    setIsScheduling(true)

    try {
      // Cancelar las existentes antes de reprogramar
      await cancelAllTripNotifications(tripId)

      // Vuelos: check-in y aeropuerto
      if (prefs.checkinReminder || prefs.airportReminder) {
        for (const flight of flightNodes) {
          const departureIso = flight.isoTime ?? flight.departureTime
          const originTz = flight.timezone ?? destinationTz
          if (!departureIso) continue

          if (prefs.checkinReminder) {
            await scheduleCheckinReminder(tripId, flight.name, departureIso, originTz)
          }
          if (prefs.airportReminder) {
            await scheduleAirportReminder(tripId, flight.name, departureIso, originTz)
          }
        }
      }

      // Resumen diario: programar para cada día del itinerario
      if (prefs.dailySummary) {
        for (const day of itinerary.graph.days) {
          const title = day.title ?? `Día ${day.dayNumber}`
          await scheduleDailySummary(tripId, title, day.date, destinationTz)
        }
      }

      Alert.alert('¡Listo!', 'Notificaciones del viaje configuradas correctamente.', [
        { text: 'Perfecto' },
      ])
    } catch (error) {
      logger.error('Error al programar notificaciones del viaje', { error, tripId })
      Alert.alert('Error', 'No se pudieron configurar las notificaciones. Inténtalo de nuevo.')
    } finally {
      setIsScheduling(false)
    }
  }

  const handleCancelAll = async () => {
    if (!tripId) return

    Alert.alert(
      'Cancelar notificaciones',
      '¿Seguro que quieres cancelar todas las notificaciones de este viaje?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            await cancelAllTripNotifications(tripId)
            Alert.alert('Listo', 'Notificaciones canceladas.')
          },
        },
      ]
    )
  }

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
          <Text className="text-base font-bold text-white">Notificaciones</Text>
          {trip ? (
            <Text className="text-xs text-slate-500" numberOfLines={1}>{trip.title}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Banner de permisos */}
        {hasPermission === false ? (
          <Pressable
            onPress={handleRequestPermission}
            className="rounded-xl bg-amber-900/50 border border-amber-700 p-4"
          >
            <Text className="text-amber-300 font-semibold text-sm">
              ⚠️ Notificaciones desactivadas
            </Text>
            <Text className="text-amber-400/70 text-xs mt-1">
              Toca aquí para activar los permisos y recibir recordatorios de tu viaje.
            </Text>
          </Pressable>
        ) : null}

        {/* Tipos de notificación */}
        <View className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 pt-4 pb-2">
            Recordatorios
          </Text>

          <NotifRow
            title="Check-in del vuelo"
            subtitle="24 horas antes de la salida"
            emoji="✈️"
            enabled={prefs.checkinReminder}
            disabled={!hasPermission || flightNodes.length === 0}
            onToggle={(v) => setPrefs((p) => ({ ...p, checkinReminder: v }))}
          />

          <NotifRow
            title="Salida al aeropuerto"
            subtitle="3 horas antes del vuelo"
            emoji="🏃"
            enabled={prefs.airportReminder}
            disabled={!hasPermission || flightNodes.length === 0}
            onToggle={(v) => setPrefs((p) => ({ ...p, airportReminder: v }))}
          />

          <NotifRow
            title="Resumen del día"
            subtitle="La noche anterior a las 21:00"
            emoji="🌙"
            enabled={prefs.dailySummary}
            disabled={!hasPermission || !itinerary}
            onToggle={(v) => setPrefs((p) => ({ ...p, dailySummary: v }))}
          />
        </View>

        {/* Contexto: vuelos detectados */}
        {flightNodes.length > 0 ? (
          <View className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Vuelos detectados
            </Text>
            {flightNodes.map((flight) => (
              <View key={flight.id} className="flex-row items-center mb-2 last:mb-0">
                <Text className="text-lg mr-2">✈️</Text>
                <View>
                  <Text className="text-white text-sm font-medium">{flight.name}</Text>
                  <Text className="text-slate-500 text-xs">
                    {flight.isoTime
                      ? new Date(flight.isoTime).toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : flight.time}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : itinerary ? (
          <View className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
            <Text className="text-slate-500 text-sm text-center">
              No hay vuelos en el itinerario
            </Text>
          </View>
        ) : null}

        {/* Acciones */}
        <View className="gap-3">
          <Pressable
            onPress={handleScheduleAll}
            disabled={isScheduling || !hasPermission || !itinerary}
            className={`rounded-xl py-3.5 items-center ${
              isScheduling || !hasPermission || !itinerary
                ? 'bg-indigo-900/50'
                : 'bg-indigo-600 active:bg-indigo-700'
            }`}
          >
            <Text className="font-semibold text-white">
              {isScheduling ? 'Configurando...' : 'Activar notificaciones'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCancelAll}
            className="rounded-xl border border-slate-700 py-3 items-center active:bg-slate-800"
          >
            <Text className="text-slate-400 text-sm">Cancelar todas las notificaciones</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Fila de toggle ───────────────────────────────────────────────────────────

interface NotifRowProps {
  title: string
  subtitle: string
  emoji: string
  enabled: boolean
  disabled: boolean
  onToggle: (value: boolean) => void
}

const NotifRow = ({ title, subtitle, emoji, enabled, disabled, onToggle }: NotifRowProps) => (
  <View className="flex-row items-center justify-between px-4 py-3 border-t border-slate-700/50">
    <View className="flex-row items-center flex-1 mr-3">
      <Text className="text-xl mr-3">{emoji}</Text>
      <View>
        <Text className={`text-sm font-medium ${disabled ? 'text-slate-500' : 'text-white'}`}>
          {title}
        </Text>
        <Text className="text-xs text-slate-500">{subtitle}</Text>
      </View>
    </View>
    <Switch
      value={enabled && !disabled}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: '#334155', true: '#4F46E5' }}
      thumbColor={enabled ? '#E0E7FF' : '#94A3B8'}
    />
  </View>
)
