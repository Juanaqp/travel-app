// Vista agenda/calendario del itinerario
// Timeline vertical de 24h con eventos posicionados por hora.
// Permite cambiar el timezone activo entre destino y origen con un toggle.

import { useState, useMemo } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useItinerary } from '@/hooks/useItinerary'
import { useTimezoneStore } from '@/stores/useTimezoneStore'
import { CalendarEventBlock } from '@/components/CalendarEventBlock'
import { DaySummary } from '@/components/DaySummary'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { formatNodeTime } from '@travelapp/types'
import type { ItineraryNode } from '@travelapp/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

// Altura total de la timeline (24 horas × píxeles por hora)
const HOUR_HEIGHT = 60
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT

// Horas marcadas en la timeline (cada 3 horas)
const TIMELINE_HOURS = [0, 3, 6, 9, 12, 15, 18, 21]

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Convierte 'HH:mm' a la posición vertical en la timeline (0 = medianoche)
const timeToTopOffset = (timeStr: string): number => {
  const [hStr, mStr] = timeStr.split(':')
  const hours = parseInt(hStr ?? '0', 10)
  const minutes = parseInt(mStr ?? '0', 10)
  return ((hours * 60 + minutes) / (24 * 60)) * TOTAL_HEIGHT
}

// Formatea fecha de día para el tab (ej: "Sab 14 Sep")
const formatDayTab = (dateStr: string): string => {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'short', day: 'numeric', month: 'short',
    }).format(new Date(dateStr + 'T12:00:00Z'))
  } catch {
    return dateStr
  }
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const { data: itinerary, isLoading, error } = useItinerary(tripId ?? '')
  const { activeTimezone, originTimezone, setTimezone } = useTimezoneStore()
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  // Timezone del destino del itinerario como fallback
  const destinationTz = itinerary?.graph.destinationTimezone ?? 'UTC'

  // Timezone actualmente activo en la vista
  const displayTz = activeTimezone ?? destinationTz

  // Opciones del toggle de timezone
  const tzOptions = useMemo(() => {
    const opts = [{ label: 'Destino', tz: destinationTz }]
    if (originTimezone && originTimezone !== destinationTz) {
      opts.push({ label: 'Origen', tz: originTimezone })
    }
    return opts
  }, [destinationTz, originTimezone])

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 pt-16">
        <View className="px-4"><LoadingSkeleton count={4} height={80} /></View>
      </View>
    )
  }

  if (error || !itinerary) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="mb-2 text-base font-bold text-white">No se pudo cargar el itinerario</Text>
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
  const currency = graph.meta.currency ?? '€'
  const selectedDay = graph.days[selectedDayIndex]
  const dayNodes: ItineraryNode[] = selectedDay
    ? selectedDay.nodeIds
        .map((id) => graph.nodes[id])
        .filter((n): n is ItineraryNode => !!n && n.userStatus !== 'rejected')
    : []

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
        <Text className="flex-1 text-base font-bold text-white">Agenda</Text>

        {/* Toggle de timezone */}
        {tzOptions.length > 1 ? (
          <View className="flex-row gap-1 rounded-xl border border-slate-700 bg-slate-800 p-0.5">
            {tzOptions.map((opt) => (
              <Pressable
                key={opt.tz}
                onPress={() => setTimezone(opt.tz)}
                className={`rounded-lg px-3 py-1 ${
                  displayTz === opt.tz ? 'bg-indigo-600' : ''
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    displayTz === opt.tz ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1">
            <Text className="text-xs text-slate-400">
              {destinationTz.split('/').pop()?.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs de días */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-slate-700"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
      >
        {graph.days.map((day, idx) => (
          <Pressable
            key={day.id}
            onPress={() => setSelectedDayIndex(idx)}
            accessibilityRole="tab"
            accessibilityState={{ selected: idx === selectedDayIndex }}
            className={`rounded-xl border px-3 py-1.5 ${
              idx === selectedDayIndex
                ? 'border-indigo-500 bg-indigo-950'
                : 'border-slate-700 bg-slate-800'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                idx === selectedDayIndex ? 'text-indigo-300' : 'text-slate-400'
              }`}
            >
              Día {day.dayNumber}
            </Text>
            <Text
              className={`text-xs ${
                idx === selectedDayIndex ? 'text-indigo-400/70' : 'text-slate-600'
              }`}
            >
              {formatDayTab(day.date)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Resumen del día */}
      <View className="px-4 pt-3">
        <DaySummary nodes={dayNodes} currency={currency} />
      </View>

      {/* Timeline vertical */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4" style={{ height: TOTAL_HEIGHT + 32 }}>
          {/* Líneas de hora y etiquetas */}
          {TIMELINE_HOURS.map((hour) => {
            const top = (hour / 24) * TOTAL_HEIGHT
            const label = `${String(hour).padStart(2, '0')}:00`
            return (
              <View
                key={hour}
                className="absolute left-0 right-0 flex-row items-center"
                style={{ top }}
              >
                <Text className="w-12 text-right text-xs text-slate-600">{label}</Text>
                <View className="ml-2 h-px flex-1 bg-slate-700/50" />
              </View>
            )
          })}

          {/* Hora actual (línea roja) si el día corresponde a hoy */}
          {selectedDay && selectedDay.date === new Date().toISOString().slice(0, 10) ? (
            <CurrentTimeLine displayTz={displayTz} />
          ) : null}

          {/* Bloques de eventos posicionados en la timeline */}
          <View className="absolute bottom-0 left-12 right-0 ml-4 top-0">
            {dayNodes.map((node) => {
              const displayTime = formatNodeTime(node, displayTz)
              const topOffset = timeToTopOffset(displayTime)
              const blockHeight = Math.max(node.durationMinutes * (HOUR_HEIGHT / 60), 36)

              return (
                <View
                  key={node.id}
                  className="absolute left-0 right-0"
                  style={{ top: topOffset }}
                >
                  <CalendarEventBlock
                    node={node}
                    displayTimezone={displayTz}
                    originTimezone={originTimezone ?? undefined}
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    onPress={(_n) => router.back()}
                  />
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Línea de hora actual ─────────────────────────────────────────────────────

const CurrentTimeLine = ({ displayTz }: { displayTz: string }) => {
  const now = new Date()
  const timeStr = new Intl.DateTimeFormat('es', {
    timeZone: displayTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  const top = timeToTopOffset(timeStr)

  return (
    <View
      className="absolute left-0 right-0 flex-row items-center"
      style={{ top }}
    >
      <View className="w-2 h-2 rounded-full bg-red-500 ml-10" />
      <View className="ml-1 h-0.5 flex-1 bg-red-500/60" />
    </View>
  )
}
