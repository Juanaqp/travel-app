// Inicialización de la base de datos SQLite local para modo offline
// Crea las 5 tablas necesarias para cachear datos del usuario sin conexión.

import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'
import { logger } from '@/lib/logger'

const DB_NAME = 'travelapp_offline.db'

// Singleton de la conexión abierta
let _db: SQLite.SQLiteDatabase | null = null

// Retorna la conexión activa, creando las tablas si aún no existen
export const getDb = async (): Promise<SQLite.SQLiteDatabase | null> => {
  if (Platform.OS === 'web') return null  // SQLite no disponible en web

  if (_db) return _db

  try {
    _db = await SQLite.openDatabaseAsync(DB_NAME)
    await initSchema(_db)
    return _db
  } catch (error) {
    logger.error('Error al abrir la base de datos offline', { error })
    return null
  }
}

// Crea las tablas si no existen — idempotente
const initSchema = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Viajes cacheados localmente
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,          -- JSON serializado del tipo Trip
      synced_at TEXT NOT NULL,     -- ISO 8601 del último sync con servidor
      deleted_at TEXT              -- soft delete local
    );

    -- Itinerarios aprobados cacheados
    CREATE TABLE IF NOT EXISTS itineraries (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      data TEXT NOT NULL,          -- JSON serializado del ItineraryGraph
      synced_at TEXT NOT NULL
    );

    -- Documentos de viaje
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      trip_id TEXT,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    );

    -- Gastos del viaje
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    );

    -- Cola de operaciones pendientes de sincronización
    CREATE TABLE IF NOT EXISTS pending_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,    -- 'trips' | 'expenses' | 'documents'
      operation TEXT NOT NULL,     -- 'insert' | 'update' | 'delete'
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,       -- JSON del payload a enviar a Supabase
      retries INTEGER DEFAULT 0,   -- veces que se ha intentado sincronizar
      created_at TEXT NOT NULL
    );
  `)

  logger.info('Esquema offline inicializado correctamente')
}

// Cierra la conexión — llamar solo al desmontar la app
export const closeDb = async (): Promise<void> => {
  if (_db) {
    await _db.closeAsync()
    _db = null
  }
}
