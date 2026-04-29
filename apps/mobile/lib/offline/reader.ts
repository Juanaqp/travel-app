// Lectura de datos offline desde SQLite
// Estas funciones se usan como fallback cuando no hay conexión a internet.

import { logger } from '@/lib/logger'
import { getDb } from './db'
import type { Trip } from '@travelapp/types'
import type { ItineraryGraph } from '@travelapp/types'

// Fila raw de SQLite para viajes
interface TripCacheRow {
  id: string
  data: string
  synced_at: string
}

// Fila raw de SQLite para itinerarios
interface ItineraryCacheRow {
  id: string
  trip_id: string
  data: string
  synced_at: string
}

// Fila genérica para documentos y gastos
interface GenericCacheRow {
  id: string
  data: string
  synced_at: string
}

// ─── Viajes ───────────────────────────────────────────────────────────────────

export const getTripsOffline = async (): Promise<Trip[]> => {
  const db = await getDb()
  if (!db) return []

  try {
    const rows = await db.getAllAsync<TripCacheRow>(
      'SELECT id, data, synced_at FROM trips WHERE deleted_at IS NULL ORDER BY synced_at DESC'
    )
    return rows.map((row) => JSON.parse(row.data) as Trip)
  } catch (error) {
    logger.error('Error al leer viajes offline', { error })
    return []
  }
}

export const saveTripsOffline = async (trips: Trip[]): Promise<void> => {
  const db = await getDb()
  if (!db) return

  const now = new Date().toISOString()
  try {
    await db.withTransactionAsync(async () => {
      for (const trip of trips) {
        await db.runAsync(
          `INSERT OR REPLACE INTO trips (id, user_id, data, synced_at)
           VALUES (?, ?, ?, ?)`,
          [trip.id, trip.userId, JSON.stringify(trip), now]
        )
      }
    })
  } catch (error) {
    logger.error('Error al guardar viajes offline', { error })
  }
}

// ─── Itinerarios ──────────────────────────────────────────────────────────────

export const getItineraryOffline = async (
  tripId: string
): Promise<{ graph: ItineraryGraph } | null> => {
  const db = await getDb()
  if (!db) return null

  try {
    const row = await db.getFirstAsync<ItineraryCacheRow>(
      'SELECT id, trip_id, data, synced_at FROM itineraries WHERE trip_id = ? LIMIT 1',
      [tripId]
    )
    if (!row) return null

    const graph = JSON.parse(row.data) as ItineraryGraph
    return { graph }
  } catch (error) {
    logger.error('Error al leer itinerario offline', { error, tripId })
    return null
  }
}

export const saveItineraryOffline = async (
  itineraryId: string,
  tripId: string,
  graph: ItineraryGraph
): Promise<void> => {
  const db = await getDb()
  if (!db) return

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO itineraries (id, trip_id, data, synced_at)
       VALUES (?, ?, ?, ?)`,
      [itineraryId, tripId, JSON.stringify(graph), new Date().toISOString()]
    )
  } catch (error) {
    logger.error('Error al guardar itinerario offline', { error, itineraryId })
  }
}

// ─── Documentos ───────────────────────────────────────────────────────────────

export const getDocumentsOffline = async (tripId: string): Promise<unknown[]> => {
  const db = await getDb()
  if (!db) return []

  try {
    const rows = await db.getAllAsync<GenericCacheRow>(
      `SELECT id, data, synced_at FROM documents
       WHERE trip_id = ? AND deleted_at IS NULL
       ORDER BY synced_at DESC`,
      [tripId]
    )
    return rows.map((row) => JSON.parse(row.data))
  } catch (error) {
    logger.error('Error al leer documentos offline', { error, tripId })
    return []
  }
}

export const saveDocumentsOffline = async (
  tripId: string,
  userId: string,
  documents: unknown[]
): Promise<void> => {
  const db = await getDb()
  if (!db) return

  const now = new Date().toISOString()
  try {
    await db.withTransactionAsync(async () => {
      for (const doc of documents) {
        const d = doc as { id: string }
        await db.runAsync(
          `INSERT OR REPLACE INTO documents (id, trip_id, user_id, data, synced_at)
           VALUES (?, ?, ?, ?, ?)`,
          [d.id, tripId, userId, JSON.stringify(doc), now]
        )
      }
    })
  } catch (error) {
    logger.error('Error al guardar documentos offline', { error, tripId })
  }
}

// ─── Gastos ───────────────────────────────────────────────────────────────────

export const getExpensesOffline = async (tripId: string): Promise<unknown[]> => {
  const db = await getDb()
  if (!db) return []

  try {
    const rows = await db.getAllAsync<GenericCacheRow>(
      `SELECT id, data, synced_at FROM expenses
       WHERE trip_id = ? AND deleted_at IS NULL
       ORDER BY synced_at DESC`,
      [tripId]
    )
    return rows.map((row) => JSON.parse(row.data))
  } catch (error) {
    logger.error('Error al leer gastos offline', { error, tripId })
    return []
  }
}

export const saveExpensesOffline = async (
  tripId: string,
  userId: string,
  expenses: unknown[]
): Promise<void> => {
  const db = await getDb()
  if (!db) return

  const now = new Date().toISOString()
  try {
    await db.withTransactionAsync(async () => {
      for (const exp of expenses) {
        const e = exp as { id: string }
        await db.runAsync(
          `INSERT OR REPLACE INTO expenses (id, trip_id, user_id, data, synced_at)
           VALUES (?, ?, ?, ?, ?)`,
          [e.id, tripId, userId, JSON.stringify(exp), now]
        )
      }
    })
  } catch (error) {
    logger.error('Error al guardar gastos offline', { error, tripId })
  }
}
