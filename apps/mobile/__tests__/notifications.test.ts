// Tests del módulo de notificaciones locales
// Cubre: check-in reminder, airport reminder, budget alert (dedup), daily summary, cancel all

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const {
  mockScheduleNotificationAsync,
  mockCancelScheduledNotificationAsync,
  mockGetPermissionsAsync,
  mockRequestPermissionsAsync,
  mockAsyncStorageGetItem,
  mockAsyncStorageSetItem,
} = vi.hoisted(() => {
  const mockScheduleNotificationAsync = vi.fn().mockResolvedValue('notif-id-001')
  const mockCancelScheduledNotificationAsync = vi.fn().mockResolvedValue(undefined)
  const mockGetPermissionsAsync = vi.fn().mockResolvedValue({ status: 'granted' })
  const mockRequestPermissionsAsync = vi.fn().mockResolvedValue({ status: 'granted' })
  const mockAsyncStorageGetItem = vi.fn().mockResolvedValue(null)
  const mockAsyncStorageSetItem = vi.fn().mockResolvedValue(undefined)

  return {
    mockScheduleNotificationAsync,
    mockCancelScheduledNotificationAsync,
    mockGetPermissionsAsync,
    mockRequestPermissionsAsync,
    mockAsyncStorageGetItem,
    mockAsyncStorageSetItem,
  }
})

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mockAsyncStorageGetItem,
    setItem: mockAsyncStorageSetItem,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

// Importar DESPUÉS de los mocks
import {
  scheduleCheckinReminder,
  scheduleAirportReminder,
  scheduleBudgetAlert,
  scheduleDailySummary,
  cancelAllTripNotifications,
  requestPermissions,
} from '../lib/notifications'

// ─── requestPermissions ──────────────────────────────────────────────────────

describe('requestPermissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna true si el permiso ya fue concedido', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' })
    const result = await requestPermissions()
    expect(result).toBe(true)
    // No debe pedir permiso si ya está concedido
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
  })

  it('solicita permiso y retorna true si el usuario acepta', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' })
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' })

    const result = await requestPermissions()
    expect(result).toBe(true)
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1)
  })

  it('retorna false si el usuario rechaza el permiso', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' })
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' })

    const result = await requestPermissions()
    expect(result).toBe(false)
  })
})

// ─── scheduleCheckinReminder ──────────────────────────────────────────────────

describe('scheduleCheckinReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sin notificaciones previas en storage
    mockAsyncStorageGetItem.mockResolvedValue(null)
    mockAsyncStorageSetItem.mockResolvedValue(undefined)
  })

  it('programa notificación exactamente 24h antes del vuelo', async () => {
    // Vuelo Lima a las 22:30 UTC-5 (= 03:30 UTC del día siguiente)
    const departureDateIso = '2026-09-14T22:30:00-05:00'

    await scheduleCheckinReminder(
      'trip-001',
      'LA2050',
      departureDateIso,
      'America/Lima'
    )

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1)

    const callArg = mockScheduleNotificationAsync.mock.calls[0]?.[0] as {
      content: { title: string; body: string }
      trigger: { date: Date }
    }

    // El trigger debe ser 24h antes del vuelo
    const departureMs = new Date(departureDateIso).getTime()
    const triggerMs = callArg.trigger.date.getTime()
    const diffHours = (departureMs - triggerMs) / (1000 * 60 * 60)

    expect(diffHours).toBeCloseTo(24, 1)
  })

  it('el título menciona check-in y la notificación contiene el nombre del vuelo', async () => {
    await scheduleCheckinReminder(
      'trip-001',
      'IB6830',
      '2026-10-01T10:00:00Z',
      'Europe/Madrid'
    )

    const callArg = mockScheduleNotificationAsync.mock.calls[0]?.[0] as {
      content: { title: string; body: string }
    }

    expect(callArg.content.title).toContain('Check-in')
    expect(callArg.content.body).toContain('IB6830')
  })

  it('asocia la notificación al tripId correcto en AsyncStorage', async () => {
    await scheduleCheckinReminder(
      'trip-abc',
      'AV55',
      '2026-11-05T08:00:00Z',
      'America/Bogota'
    )

    // Verifica que se guardó el ID de notificación bajo el trip correcto
    const setItemCalls = mockAsyncStorageSetItem.mock.calls
    const notifMapCall = setItemCalls.find(([key]) => key === '@travelapp/notification_ids')
    expect(notifMapCall).toBeDefined()

    const savedMap = JSON.parse(notifMapCall![1]) as Record<string, string[]>
    expect(savedMap['trip-abc']).toContain('notif-id-001')
  })

  it('no programa si la fecha de vuelo ya pasó', async () => {
    // Fecha en el pasado
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    await scheduleCheckinReminder('trip-past', 'XX000', pastDate, 'UTC')

    // scheduleAt verifica `scheduledDate <= new Date()` y no programa
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled()
  })
})

// ─── scheduleAirportReminder ──────────────────────────────────────────────────

describe('scheduleAirportReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAsyncStorageGetItem.mockResolvedValue(null)
  })

  it('programa DOS notificaciones: 3h y 2.5h antes del vuelo', async () => {
    await scheduleAirportReminder(
      'trip-001',
      'LA2050',
      '2026-09-14T22:30:00-05:00',
      'America/Lima'
    )

    // Debe llamarse dos veces: 3h y 2.5h antes
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2)
  })

  it('la primera notificación es 3h antes y la segunda 2.5h antes', async () => {
    const departureDateIso = '2026-09-20T15:00:00Z'

    await scheduleAirportReminder('trip-001', 'VY1234', departureDateIso, 'UTC')

    const calls = mockScheduleNotificationAsync.mock.calls as Array<[{ trigger: { date: Date } }]>
    const departureMs = new Date(departureDateIso).getTime()

    const diff0 = (departureMs - calls[0]![0].trigger.date.getTime()) / (1000 * 60 * 60)
    const diff1 = (departureMs - calls[1]![0].trigger.date.getTime()) / (1000 * 60 * 60)

    expect(diff0).toBeCloseTo(3, 1)
    expect(diff1).toBeCloseTo(2.5, 1)
  })
})

// ─── scheduleBudgetAlert ──────────────────────────────────────────────────────

describe('scheduleBudgetAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAsyncStorageGetItem.mockResolvedValue(null)  // sin alertas previas
    mockAsyncStorageSetItem.mockResolvedValue(undefined)
  })

  it('no programa si el presupuesto es 0 o negativo', async () => {
    await scheduleBudgetAlert('trip-001', 50, 0, 'EUR')
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('programa alerta al 80% cuando se llega al umbral', async () => {
    await scheduleBudgetAlert('trip-001', 80, 100, 'USD')

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1)
    const callArg = mockScheduleNotificationAsync.mock.calls[0]?.[0] as {
      content: { title: string; body: string }
    }
    expect(callArg.content.title).toContain('80%')
  })

  it('programa alerta al 100% cuando se supera el presupuesto', async () => {
    await scheduleBudgetAlert('trip-001', 120, 100, 'EUR')

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1)
    const callArg = mockScheduleNotificationAsync.mock.calls[0]?.[0] as {
      content: { title: string; body: string }
    }
    expect(callArg.content.title).toContain('agotado')
  })

  it('no repite la alerta del 80% si ya fue enviada (deduplicación)', async () => {
    // Simula que la alerta del 80% ya fue enviada
    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ 'trip-001_80': true })
    )

    await scheduleBudgetAlert('trip-001', 85, 100, 'USD')

    // No debe programar otra notificación — ya fue enviada
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('no repite la alerta del 100% si ya fue enviada (deduplicación)', async () => {
    // Ambas alertas ya enviadas — ninguna debe dispararse de nuevo
    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ 'trip-001_80': true, 'trip-001_100': true })
    )

    await scheduleBudgetAlert('trip-001', 150, 100, 'EUR')

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('no programa nada si el porcentaje está por debajo del 80%', async () => {
    await scheduleBudgetAlert('trip-001', 70, 100, 'USD')
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('persiste el estado de alerta en AsyncStorage tras enviar', async () => {
    await scheduleBudgetAlert('trip-001', 80, 100, 'USD')

    const setItemCalls = mockAsyncStorageSetItem.mock.calls
    const budgetCall = setItemCalls.find(([key]) => key === '@travelapp/budget_alerts_sent')
    expect(budgetCall).toBeDefined()

    const savedState = JSON.parse(budgetCall![1]) as Record<string, boolean>
    expect(savedState['trip-001_80']).toBe(true)
  })
})

// ─── scheduleDailySummary ────────────────────────────────────────────────────

describe('scheduleDailySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAsyncStorageGetItem.mockResolvedValue(null)
  })

  it('programa notificación el día anterior a las 21:00 en el timezone destino', async () => {
    // Día del itinerario: 2026-07-15 en Europe/Madrid (CEST = UTC+2)
    // Esperamos notificación el 2026-07-14 a las 21:00 CEST = 19:00 UTC
    await scheduleDailySummary(
      'trip-001',
      'Día 2 — Roma: Museos y gastronomía',
      '2026-07-15',
      'Europe/Rome'
    )

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1)
    const callArg = mockScheduleNotificationAsync.mock.calls[0]?.[0] as {
      content: { body: string }
      trigger: { date: Date }
    }

    // El trigger debe ser el día anterior (14 de julio)
    const triggerDate = callArg.trigger.date
    expect(triggerDate.getUTCDate()).toBeLessThan(15)  // antes del día 15 UTC

    // Verifica que el body contiene el título del día
    expect(callArg.content.body).toContain('Roma')
  })
})

// ─── cancelAllTripNotifications ──────────────────────────────────────────────

describe('cancelAllTripNotifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cancela todas las notificaciones registradas para el viaje', async () => {
    // Simula 3 notificaciones registradas para el viaje
    const notifMap = { 'trip-001': ['id-1', 'id-2', 'id-3'], 'trip-002': ['id-4'] }
    mockAsyncStorageGetItem.mockImplementation((key: string) => {
      if (key === '@travelapp/notification_ids') return Promise.resolve(JSON.stringify(notifMap))
      return Promise.resolve(null)
    })

    await cancelAllTripNotifications('trip-001')

    // Debe cancelar exactamente los 3 IDs del viaje
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(3)
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('id-1')
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('id-2')
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('id-3')
  })

  it('elimina el viaje del mapa de notificaciones tras cancelar', async () => {
    const notifMap = { 'trip-001': ['id-1'], 'trip-002': ['id-4'] }
    mockAsyncStorageGetItem.mockResolvedValue(JSON.stringify(notifMap))

    await cancelAllTripNotifications('trip-001')

    const setItemCalls = mockAsyncStorageSetItem.mock.calls
    const mapCall = setItemCalls.find(([key]) => key === '@travelapp/notification_ids')
    expect(mapCall).toBeDefined()

    const savedMap = JSON.parse(mapCall![1]) as Record<string, string[]>
    // trip-001 debe estar eliminado, trip-002 debe permanecer
    expect(savedMap['trip-001']).toBeUndefined()
    expect(savedMap['trip-002']).toEqual(['id-4'])
  })

  it('limpia también las alertas de presupuesto del viaje', async () => {
    mockAsyncStorageGetItem.mockImplementation((key: string) => {
      if (key === '@travelapp/notification_ids') {
        return Promise.resolve(JSON.stringify({ 'trip-001': ['id-1'] }))
      }
      if (key === '@travelapp/budget_alerts_sent') {
        return Promise.resolve(JSON.stringify({ 'trip-001_80': true, 'trip-001_100': false, 'trip-002_80': true }))
      }
      return Promise.resolve(null)
    })

    await cancelAllTripNotifications('trip-001')

    const budgetCall = mockAsyncStorageSetItem.mock.calls.find(
      ([key]) => key === '@travelapp/budget_alerts_sent'
    )
    expect(budgetCall).toBeDefined()

    const savedBudget = JSON.parse(budgetCall![1]) as Record<string, boolean>
    expect(savedBudget['trip-001_80']).toBeUndefined()
    expect(savedBudget['trip-001_100']).toBeUndefined()
    // Alertas de trip-002 deben permanecer
    expect(savedBudget['trip-002_80']).toBe(true)
  })

  it('no lanza si el viaje no tiene notificaciones registradas', async () => {
    // Mapa vacío — el viaje no tiene notificaciones
    mockAsyncStorageGetItem.mockResolvedValue(JSON.stringify({}))

    await expect(cancelAllTripNotifications('trip-sin-notifs')).resolves.toBeUndefined()
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled()
  })
})
