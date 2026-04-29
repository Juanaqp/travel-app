import { describe, it, expect, vi } from 'vitest'
import { convertToTimezone, formatNodeTime, getDayOffset } from '@travelapp/types'
import type { BaseNode } from '@travelapp/types'

// Mock AsyncStorage para que el persist middleware no falle en entorno Node
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}))

// ─── Datos de prueba ─────────────────────────────────────────────────────────

// Vuelo Lima → Roma: sale 22:30 hora Lima (UTC-5), llega 05:30+1 hora Roma (UTC+2)
// Lima   = UTC-5  → "2025-09-14T22:30:00-05:00"
// Roma   = UTC+2  → diferencia de 7 horas → 22:30 + 7h = 05:30 del día siguiente

const LIMA_ISO = '2025-09-14T22:30:00-05:00'   // 22:30 hora Lima
const LIMA_TZ  = 'America/Lima'
const ROME_TZ  = 'Europe/Rome'

const makeNode = (overrides: Partial<BaseNode> = {}): BaseNode => ({
  id: 'node-1',
  type: 'flight',
  dayId: 'day-1',
  order: 0,
  time: '22:30',
  durationMinutes: 13 * 60,    // vuelo de 13 horas Lima→Roma
  endTime: '11:30',
  name: 'Vuelo Lima → Roma',
  description: '',
  emoji: '✈️',
  aiTip: '',
  location: {},
  cost: {},
  userStatus: 'approved',
  isAiGenerated: true,
  isUserModified: false,
  createdAt: new Date().toISOString(),
  ...overrides,
})

// ─── convertToTimezone ────────────────────────────────────────────────────────

describe('convertToTimezone', () => {
  it('convierte 22:30 hora Lima a 05:30 hora Roma (diferencia de 7 horas)', () => {
    const result = convertToTimezone(LIMA_ISO, ROME_TZ)
    // La fecha en Roma sería 2025-09-15T05:30:00+02:00 (UTC 03:30, +2 Roma = 05:30)
    expect(result).toBe('05:30')
  })

  it('mantiene la misma hora al convertir al mismo timezone', () => {
    const result = convertToTimezone(LIMA_ISO, LIMA_TZ)
    expect(result).toBe('22:30')
  })

  it('devuelve fallback HH:mm del ISO si el timezone es inválido', () => {
    const result = convertToTimezone(LIMA_ISO, 'Timezone/Invalido')
    // Fallback extrae HH:mm del string ISO → "22:30"
    expect(result).toBe('22:30')
  })

  it('convierte correctamente UTC a timezone con offset positivo', () => {
    const utcIso = '2025-09-15T03:30:00+00:00'  // UTC equivalente de Lima ISO
    const result = convertToTimezone(utcIso, ROME_TZ)
    expect(result).toBe('05:30')
  })
})

// ─── formatNodeTime ───────────────────────────────────────────────────────────

describe('formatNodeTime', () => {
  it('usa time string (HH:mm) cuando no hay isoTime', () => {
    const node = makeNode({ time: '22:30' })
    expect(formatNodeTime(node)).toBe('22:30')
  })

  it('usa isoTime con displayTimezone cuando ambos están disponibles', () => {
    const node = makeNode({ isoTime: LIMA_ISO, timezone: LIMA_TZ })
    const result = formatNodeTime(node, ROME_TZ)
    expect(result).toBe('05:30')
  })

  it('usa el timezone propio del nodo cuando no se pasa displayTimezone', () => {
    const node = makeNode({ isoTime: LIMA_ISO, timezone: LIMA_TZ })
    const result = formatNodeTime(node)
    expect(result).toBe('22:30')
  })

  it('extrae HH:mm del ISO si isoTime existe pero no hay timezone', () => {
    const node = makeNode({ isoTime: LIMA_ISO, timezone: undefined })
    const result = formatNodeTime(node)
    expect(result).toBe('22:30')  // extrae los chars 11-16 del ISO string
  })

  it('vuelo Lima→Roma: 22:30 hora Lima aparece como 05:30 hora Roma', () => {
    const node = makeNode({ isoTime: LIMA_ISO, timezone: LIMA_TZ })
    const displayed = formatNodeTime(node, ROME_TZ)
    expect(displayed).toBe('05:30')
  })
})

// ─── getDayOffset ─────────────────────────────────────────────────────────────

describe('getDayOffset', () => {
  it('devuelve 0 cuando origen y destino están en el mismo día', () => {
    // 09:00 Lima → 16:00 Roma — mismo día
    const morningLima = '2025-09-14T09:00:00-05:00'
    const offset = getDayOffset(morningLima, LIMA_TZ, ROME_TZ)
    expect(offset).toBe(0)
  })

  it('devuelve +1 para vuelo nocturno que llega al día siguiente', () => {
    // El ISO del vuelo Lima→Roma es la hora de SALIDA desde Lima en UTC:
    // 22:30 Lima (UTC-5) = 03:30 UTC del día 15
    // En Roma (UTC+2) = 05:30 del día 15
    // Así que desde la perspectiva del día origen (14 Sep en Lima),
    // la llegada (05:30 Roma del 15 Sep) es +1 día
    const arrivalIso = '2025-09-15T03:30:00+00:00'  // 05:30 Roma
    const offset = getDayOffset(arrivalIso, LIMA_TZ, ROME_TZ)
    expect(offset).toBe(1)
  })

  it('devuelve 0 para el mismo timezone', () => {
    const offset = getDayOffset(LIMA_ISO, LIMA_TZ, LIMA_TZ)
    expect(offset).toBe(0)
  })

  it('devuelve 0 para timezone inválido (sin lanzar excepción)', () => {
    expect(() => getDayOffset(LIMA_ISO, LIMA_TZ, 'Invalido/TZ')).not.toThrow()
  })
})

// ─── Toggle de timezone en useTimezoneStore ───────────────────────────────────

describe('useTimezoneStore — toggle de timezone', () => {
  // Los tests del store de Zustand usan el escape hatch .getState()
  // sin necesidad de React (son tests de lógica pura de estado)

  it('setTimezone actualiza activeTimezone', async () => {
    const { useTimezoneStore } = await import('../stores/useTimezoneStore')
    useTimezoneStore.getState().setTimezone(ROME_TZ)
    expect(useTimezoneStore.getState().activeTimezone).toBe(ROME_TZ)
  })

  it('setOriginTimezone actualiza originTimezone', async () => {
    const { useTimezoneStore } = await import('../stores/useTimezoneStore')
    useTimezoneStore.getState().setOriginTimezone(LIMA_TZ)
    expect(useTimezoneStore.getState().originTimezone).toBe(LIMA_TZ)
  })

  it('reset limpia ambos campos', async () => {
    const { useTimezoneStore } = await import('../stores/useTimezoneStore')
    useTimezoneStore.getState().setTimezone(ROME_TZ)
    useTimezoneStore.getState().reset()
    expect(useTimezoneStore.getState().activeTimezone).toBeNull()
    expect(useTimezoneStore.getState().originTimezone).toBeNull()
  })

  it('toggle entre Lima y Roma reconvierte los eventos correctamente', async () => {
    // Simula el comportamiento del toggle en CalendarScreen:
    // setTimezone(LIMA_TZ) → formatNodeTime devuelve 22:30
    // setTimezone(ROME_TZ) → formatNodeTime devuelve 05:30
    const { useTimezoneStore } = await import('../stores/useTimezoneStore')
    const node = makeNode({ isoTime: LIMA_ISO, timezone: LIMA_TZ })

    useTimezoneStore.getState().setTimezone(LIMA_TZ)
    const displayedInLima = formatNodeTime(node, useTimezoneStore.getState().activeTimezone!)
    expect(displayedInLima).toBe('22:30')

    useTimezoneStore.getState().setTimezone(ROME_TZ)
    const displayedInRome = formatNodeTime(node, useTimezoneStore.getState().activeTimezone!)
    expect(displayedInRome).toBe('05:30')
  })
})
