// Módulo de notificaciones locales con expo-notifications
// Gestiona recordatorios de check-in, aeropuerto, presupuesto y resumen diario.
// Todas las fechas se calculan en el timezone correcto del viaje.

import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { logger } from '@/lib/logger'

// ─── Configuración global del handler ────────────────────────────────────────
// Muestra la notificación aunque la app esté en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY_IDS = '@travelapp/notification_ids'
const STORAGE_KEY_BUDGET_ALERTS = '@travelapp/budget_alerts_sent'

// ─── Helpers de AsyncStorage ──────────────────────────────────────────────────

// Carga el mapa tripId → [notificationId] del storage
const loadNotificationIds = async (): Promise<Record<string, string[]>> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_IDS)
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

const saveNotificationIds = async (map: Record<string, string[]>): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_IDS, JSON.stringify(map))
  } catch (error) {
    logger.warn('No se pudo guardar los IDs de notificaciones', { error })
  }
}

// Registra un ID de notificación asociado a un viaje para poder cancelarlas todas
const registerNotificationId = async (tripId: string, notifId: string): Promise<void> => {
  const map = await loadNotificationIds()
  map[tripId] = [...(map[tripId] ?? []), notifId]
  await saveNotificationIds(map)
}

// ─── Permiso ──────────────────────────────────────────────────────────────────

export const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false

  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true

    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch (error) {
    logger.error('Error al solicitar permisos de notificación', { error })
    return false
  }
}

// ─── Función base de programación ────────────────────────────────────────────

const scheduleAt = async (
  tripId: string,
  title: string,
  body: string,
  scheduledDate: Date,
  data?: Record<string, unknown>
): Promise<void> => {
  if (Platform.OS === 'web') return
  if (scheduledDate <= new Date()) return  // ya pasó — no programar

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { tripId, ...data }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: scheduledDate },
    })
    await registerNotificationId(tripId, id)
    logger.info('Notificación programada', { tripId, title, scheduledDate })
  } catch (error) {
    logger.error('Error al programar notificación', { error, title })
  }
}

// ─── Helpers de timezone ──────────────────────────────────────────────────────

// Construye un Date a la hora HH:mm en el timezone dado para la fecha base ISO
const buildDateInTimezone = (
  baseIso: string,    // fecha base en ISO: '2025-09-14T22:30:00-05:00'
  hour: number,
  minute: number,
  timezone: string
): Date | null => {
  try {
    // Extraer la fecha YYYY-MM-DD en el timezone objetivo
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(baseIso))

    const m = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    const localIso = `${m.year}-${m.month}-${m.day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`

    // Convertir la hora local en ese timezone a UTC
    // Usamos la diferencia entre el timestamp local y UTC para el offset
    const localDate = new Date(localIso)
    const utcOffset = new Date(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(localDate)
    )
    const diff = localDate.getTime() - utcOffset.getTime()
    return new Date(localDate.getTime() + diff)
  } catch {
    return null
  }
}

// ─── Recordatorio de check-in (24h antes del vuelo de salida) ────────────────

export const scheduleCheckinReminder = async (
  tripId: string,
  flightName: string,
  departureDateIso: string,    // ISO 8601: '2025-09-14T22:30:00-05:00'
  originTimezone: string        // IANA: 'America/Lima'
): Promise<void> => {
  const departureDate = new Date(departureDateIso)
  const reminderDate = new Date(departureDate.getTime() - 24 * 60 * 60 * 1000)

  await scheduleAt(
    tripId,
    '✈️ Check-in disponible',
    `Puedes hacer el check-in online para tu vuelo ${flightName}`,
    reminderDate,
    { type: 'checkin', originTimezone }
  )
}

// ─── Recordatorio de aeropuerto (3h antes → alerta, 2.5h → recordatorio) ────

export const scheduleAirportReminder = async (
  tripId: string,
  flightName: string,
  departureDateIso: string,
  originTimezone: string
): Promise<void> => {
  const departureDate = new Date(departureDateIso)

  // Alerta 3h antes
  const alert3h = new Date(departureDate.getTime() - 3 * 60 * 60 * 1000)
  await scheduleAt(
    tripId,
    '🏃 Hora de ir al aeropuerto',
    `Tu vuelo ${flightName} sale en 3 horas. ¡Es hora de salir!`,
    alert3h,
    { type: 'airport_3h', originTimezone }
  )

  // Recordatorio 2.5h antes
  const alert25h = new Date(departureDate.getTime() - 2.5 * 60 * 60 * 1000)
  await scheduleAt(
    tripId,
    '⚡ Vuelo en 2.5 horas',
    `No olvides tener a mano tus documentos para el vuelo ${flightName}`,
    alert25h,
    { type: 'airport_2h5', originTimezone }
  )
}

// ─── Alerta de presupuesto (80% y 100%) — con deduplicación ──────────────────

export const scheduleBudgetAlert = async (
  tripId: string,
  currentAmount: number,
  totalBudget: number,
  currency: string
): Promise<void> => {
  if (totalBudget <= 0) return

  const percentage = (currentAmount / totalBudget) * 100

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_BUDGET_ALERTS)
    const sent = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}

    if (percentage >= 100 && !sent[`${tripId}_100`]) {
      await scheduleAt(
        tripId,
        '🚨 Presupuesto agotado',
        `Has superado tu presupuesto de ${totalBudget} ${currency}`,
        new Date(Date.now() + 2000),  // casi inmediato
        { type: 'budget_100' }
      )
      sent[`${tripId}_100`] = true
      await AsyncStorage.setItem(STORAGE_KEY_BUDGET_ALERTS, JSON.stringify(sent))
    } else if (percentage >= 80 && !sent[`${tripId}_80`]) {
      await scheduleAt(
        tripId,
        '⚠️ Presupuesto al 80%',
        `Has usado ${Math.round(percentage)}% de tu presupuesto de ${totalBudget} ${currency}`,
        new Date(Date.now() + 2000),
        { type: 'budget_80' }
      )
      sent[`${tripId}_80`] = true
      await AsyncStorage.setItem(STORAGE_KEY_BUDGET_ALERTS, JSON.stringify(sent))
    }
  } catch (error) {
    logger.error('Error al gestionar alerta de presupuesto', { error, tripId })
  }
}

// ─── Resumen diario (21:00 en timezone del destino, el día anterior) ──────────

export const scheduleDailySummary = async (
  tripId: string,
  dayTitle: string,            // 'Día 2 — Roma: Museos y gastronomía'
  dayDateIso: string,          // 'YYYY-MM-DD' del día del itinerario
  destinationTimezone: string
): Promise<void> => {
  // La notificación se envía el día anterior a las 21:00 en el timezone destino
  const baseIso = `${dayDateIso}T12:00:00Z`
  const previousDay = new Date(new Date(baseIso).getTime() - 24 * 60 * 60 * 1000).toISOString()
  const reminderDate = buildDateInTimezone(previousDay, 21, 0, destinationTimezone)

  if (!reminderDate) return

  await scheduleAt(
    tripId,
    '🌙 Plan de mañana',
    dayTitle,
    reminderDate,
    { type: 'daily_summary', destinationTimezone }
  )
}

// ─── Cancelar todas las notificaciones de un viaje ───────────────────────────

export const cancelAllTripNotifications = async (tripId: string): Promise<void> => {
  if (Platform.OS === 'web') return

  try {
    const map = await loadNotificationIds()
    const ids = map[tripId] ?? []

    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)))

    // Limpiar los IDs del viaje del storage
    delete map[tripId]
    await saveNotificationIds(map)

    // Limpiar alertas de presupuesto del viaje
    const raw = await AsyncStorage.getItem(STORAGE_KEY_BUDGET_ALERTS)
    if (raw) {
      const sent = JSON.parse(raw) as Record<string, boolean>
      delete sent[`${tripId}_80`]
      delete sent[`${tripId}_100`]
      await AsyncStorage.setItem(STORAGE_KEY_BUDGET_ALERTS, JSON.stringify(sent))
    }

    logger.info('Notificaciones del viaje canceladas', { tripId, count: ids.length })
  } catch (error) {
    logger.error('Error al cancelar notificaciones del viaje', { error, tripId })
  }
}
