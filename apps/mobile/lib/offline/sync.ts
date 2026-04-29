// Sincronización de operaciones pendientes con Supabase
// Gestiona la cola de operaciones offline y las aplica en batch cuando hay conexión.
// Incluye descarga de archivos de documentos para acceso sin conexión.

import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getDb } from './db'
import type { TravelDocument } from '@travelapp/types'

const MAX_RETRIES = 3
const BATCH_SIZE = 10

// Tipo de una operación en la cola
interface PendingOperation {
  id: number
  table_name: string
  operation: 'insert' | 'update' | 'delete'
  record_id: string
  payload: string   // JSON
  retries: number
  created_at: string
}

// ─── Agregar operación a la cola ─────────────────────────────────────────────

export const addPendingOperation = async (
  tableName: string,
  operation: 'insert' | 'update' | 'delete',
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const db = await getDb()
  if (!db) return  // En web no hay cola offline

  try {
    await db.runAsync(
      `INSERT INTO pending_operations (table_name, operation, record_id, payload, retries, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [tableName, operation, recordId, JSON.stringify(payload), new Date().toISOString()]
    )
    logger.info('Operación encolada para sincronización', { tableName, operation, recordId })
  } catch (error) {
    logger.error('Error al encolar operación offline', { error, tableName, operation, recordId })
  }
}

// ─── Sincronizar operaciones pendientes ──────────────────────────────────────

export const syncPendingOperations = async (): Promise<{
  synced: number
  failed: number
}> => {
  const db = await getDb()
  if (!db) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  try {
    // Cargar el primer lote de operaciones con reintentos disponibles
    const operations = await db.getAllAsync<PendingOperation>(
      `SELECT * FROM pending_operations
       WHERE retries < ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [MAX_RETRIES, BATCH_SIZE]
    )

    for (const op of operations) {
      const success = await applyOperation(op)

      if (success) {
        await db.runAsync('DELETE FROM pending_operations WHERE id = ?', [op.id])
        synced++
      } else {
        await db.runAsync(
          'UPDATE pending_operations SET retries = retries + 1 WHERE id = ?',
          [op.id]
        )
        failed++
        logger.warn('Operación pendiente fallida — incrementando reintentos', {
          opId: op.id,
          tableName: op.table_name,
          retries: op.retries + 1,
        })
      }
    }

    if (synced > 0 || failed > 0) {
      logger.info('Sincronización de operaciones pendientes completada', { synced, failed })
    }
  } catch (error) {
    logger.error('Error en sincronización de operaciones pendientes', { error })
  }

  return { synced, failed }
}

// ─── Aplicar una operación individual contra Supabase ────────────────────────

const applyOperation = async (op: PendingOperation): Promise<boolean> => {
  try {
    const payload = JSON.parse(op.payload) as Record<string, unknown>

    if (op.operation === 'insert') {
      const { error } = await supabase.from(op.table_name).insert(payload)
      if (error) throw error
    } else if (op.operation === 'update') {
      const { error } = await supabase
        .from(op.table_name)
        .update(payload)
        .eq('id', op.record_id)
      if (error) throw error
    } else if (op.operation === 'delete') {
      const { error } = await supabase
        .from(op.table_name)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', op.record_id)
      if (error) throw error
    }

    return true
  } catch (error) {
    logger.warn('Error al aplicar operación offline contra Supabase', {
      error,
      opId: op.id,
      table: op.table_name,
      operation: op.operation,
    })
    return false
  }
}

// ─── Contar operaciones pendientes ───────────────────────────────────────────

export const countPendingOperations = async (): Promise<number> => {
  const db = await getDb()
  if (!db) return 0

  try {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM pending_operations WHERE retries < ?',
      [MAX_RETRIES]
    )
    return result?.count ?? 0
  } catch {
    return 0
  }
}

// ─── Descarga de documentos para uso offline ──────────────────────────────────
// Genera URL firmada por documento → descarga a FileSystem → actualiza ruta local en SQLite

export const downloadTripForOffline = async (
  tripId: string,
  documents: TravelDocument[],
  _userId: string
): Promise<void> => {
  const db = await getDb()
  if (!db) return  // En web no hay almacenamiento local de archivos

  for (const doc of documents) {
    if (!doc.storagePath) continue

    try {
      // Generar URL firmada válida por 1 hora para descargar el archivo
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storagePath, 3600)

      if (error || !data?.signedUrl) {
        logger.warn('No se pudo generar URL firmada para descarga offline', {
          docId: doc.id,
          storagePath: doc.storagePath,
        })
        continue
      }

      // Construir ruta local dentro del directorio de la app
      const localDir = `${FileSystem.documentDirectory}${tripId}/docs/`
      const localPath = `${localDir}${doc.fileName}`

      // Crear directorio si no existe
      await FileSystem.makeDirectoryAsync(localDir, { intermediates: true })

      // Descargar archivo desde Storage a FileSystem local
      const { status } = await FileSystem.downloadAsync(data.signedUrl, localPath)

      if (status !== 200) {
        logger.warn('Descarga fallida para documento offline', { docId: doc.id, status })
        continue
      }

      // Actualizar el registro SQLite con la ruta local del archivo descargado
      const existingRow = await db.getFirstAsync<{ data: string }>(
        'SELECT data FROM documents WHERE id = ?',
        [doc.id]
      )

      if (existingRow) {
        const existingData = JSON.parse(existingRow.data) as TravelDocument
        const updatedData = { ...existingData, localFilePath: localPath }
        await db.runAsync(
          'UPDATE documents SET data = ? WHERE id = ?',
          [JSON.stringify(updatedData), doc.id]
        )
      }

      logger.info('Documento descargado para uso offline', { docId: doc.id, localPath })
    } catch (error) {
      logger.warn('Error al descargar documento para offline', { error, docId: doc.id })
    }
  }
}
