// Tests del módulo offline — db.ts, reader.ts, sync.ts
// Cubre: inicialización SQLite, lectura/escritura de caché, cola de sincronización

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const {
  mockGetDb,
  mockExecAsync,
  mockRunAsync,
  mockGetAllAsync,
  mockGetFirstAsync,
  mockWithTransactionAsync,
  mockSupabaseFrom,
  mockSupabaseGetUser,
} = vi.hoisted(() => {
  const mockExecAsync = vi.fn().mockResolvedValue(undefined)
  const mockRunAsync = vi.fn().mockResolvedValue(undefined)
  const mockGetAllAsync = vi.fn().mockResolvedValue([])
  const mockGetFirstAsync = vi.fn().mockResolvedValue(null)
  const mockWithTransactionAsync = vi.fn().mockImplementation(
    async (fn: () => Promise<void>) => fn()
  )
  const mockGetDb = vi.fn()
  const mockSupabaseFrom = vi.fn()
  const mockSupabaseGetUser = vi.fn()

  return {
    mockGetDb,
    mockExecAsync,
    mockRunAsync,
    mockGetAllAsync,
    mockGetFirstAsync,
    mockWithTransactionAsync,
    mockSupabaseFrom,
    mockSupabaseGetUser,
  }
})

// ─── Mock de la base de datos en memoria ────────────────────────────────────

const createFakeDb = () => ({
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getAllAsync: mockGetAllAsync,
  getFirstAsync: mockGetFirstAsync,
  withTransactionAsync: mockWithTransactionAsync,
  closeAsync: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@/lib/offline/db', () => ({
  getDb: mockGetDb,
  closeDb: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockSupabaseGetUser },
    from: mockSupabaseFrom,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock-docs-dir/',
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  downloadAsync: vi.fn().mockResolvedValue({ status: 200, uri: '/mock/path' }),
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

vi.mock('@travelapp/types', () => ({}))

// Importar DESPUÉS de los mocks
import {
  getTripsOffline,
  saveTripsOffline,
  getDocumentsOffline,
  saveDocumentsOffline,
  getExpensesOffline,
  saveExpensesOffline,
} from '../lib/offline/reader'
import {
  addPendingOperation,
  syncPendingOperations,
  countPendingOperations,
} from '../lib/offline/sync'
import type { Trip } from '@travelapp/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_TRIP: Trip = {
  id: 'trip-001',
  userId: 'user-abc',
  title: 'Roma 2026',
  status: 'planning',
  destinations: [{ city: 'Roma', country: 'Italia' }],
  travelersCount: 2,
  baseCurrency: 'EUR',
  createdAt: '2026-04-28T00:00:00Z',
  updatedAt: '2026-04-28T00:00:00Z',
  deletedAt: null,
}

const MOCK_PENDING_OP = {
  id: 1,
  table_name: 'trips',
  operation: 'update' as const,
  record_id: 'trip-001',
  payload: JSON.stringify({ title: 'Roma actualizada' }),
  retries: 0,
  created_at: '2026-04-28T10:00:00Z',
}

// ─── getTripsOffline / saveTripsOffline ───────────────────────────────────────

describe('getTripsOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('retorna array vacío si no hay filas en SQLite', async () => {
    mockGetAllAsync.mockResolvedValue([])
    const trips = await getTripsOffline()
    expect(trips).toEqual([])
  })

  it('retorna viajes deserializados desde JSON', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: MOCK_TRIP.id, data: JSON.stringify(MOCK_TRIP), synced_at: '2026-04-28T00:00:00Z' },
    ])

    const trips = await getTripsOffline()

    expect(trips).toHaveLength(1)
    expect(trips[0]?.id).toBe('trip-001')
    expect(trips[0]?.title).toBe('Roma 2026')
  })

  it('retorna array vacío cuando getDb retorna null (web)', async () => {
    mockGetDb.mockResolvedValue(null)
    const trips = await getTripsOffline()
    expect(trips).toEqual([])
  })

  it('consulta solo filas sin deleted_at (soft delete offline)', async () => {
    mockGetAllAsync.mockResolvedValue([])
    await getTripsOffline()
    const query = mockGetAllAsync.mock.calls[0]?.[0] as string
    expect(query).toContain('deleted_at IS NULL')
  })
})

describe('saveTripsOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('guarda viajes en SQLite con INSERT OR REPLACE', async () => {
    await saveTripsOffline([MOCK_TRIP])

    // withTransactionAsync debe haber sido llamado
    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1)
    // runAsync debe haber sido llamado para cada viaje
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO trips'),
      expect.arrayContaining([MOCK_TRIP.id, MOCK_TRIP.userId])
    )
  })

  it('no lanza error si getDb retorna null (web)', async () => {
    mockGetDb.mockResolvedValue(null)
    await expect(saveTripsOffline([MOCK_TRIP])).resolves.toBeUndefined()
  })

  it('no hace nada si el array está vacío', async () => {
    await saveTripsOffline([])
    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1)
    expect(mockRunAsync).not.toHaveBeenCalled()
  })
})

// ─── getDocumentsOffline / saveDocumentsOffline ───────────────────────────────

describe('getDocumentsOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  const MOCK_DOC = { id: 'doc-001', title: 'Boarding Pass', type: 'flight' }

  it('retorna documentos deserializados del trip indicado', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: 'doc-001', data: JSON.stringify(MOCK_DOC), synced_at: '2026-04-28T00:00:00Z' },
    ])

    const docs = await getDocumentsOffline('trip-001')
    expect(docs).toHaveLength(1)
    expect((docs[0] as typeof MOCK_DOC).id).toBe('doc-001')
  })

  it('filtra por trip_id y deleted_at IS NULL', async () => {
    mockGetAllAsync.mockResolvedValue([])
    await getDocumentsOffline('trip-001')

    const [query, params] = mockGetAllAsync.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('trip_id = ?')
    expect(query).toContain('deleted_at IS NULL')
    expect(params).toContain('trip-001')
  })
})

describe('saveDocumentsOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('guarda documentos con INSERT OR REPLACE', async () => {
    const doc = { id: 'doc-001', title: 'Boarding Pass' }
    await saveDocumentsOffline('trip-001', 'user-abc', [doc])

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1)
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO documents'),
      expect.arrayContaining(['doc-001', 'trip-001', 'user-abc'])
    )
  })
})

// ─── getExpensesOffline / saveExpensesOffline ─────────────────────────────────

describe('getExpensesOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('retorna gastos deserializados del trip indicado', async () => {
    const mockExpense = { id: 'exp-001', amount: 40, currency: 'EUR' }
    mockGetAllAsync.mockResolvedValue([
      { id: 'exp-001', data: JSON.stringify(mockExpense), synced_at: '2026-04-28T00:00:00Z' },
    ])

    const expenses = await getExpensesOffline('trip-001')
    expect(expenses).toHaveLength(1)
    expect((expenses[0] as typeof mockExpense).amount).toBe(40)
  })

  it('retorna array vacío si no hay gastos', async () => {
    mockGetAllAsync.mockResolvedValue([])
    const expenses = await getExpensesOffline('trip-001')
    expect(expenses).toEqual([])
  })
})

describe('saveExpensesOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('guarda gastos con INSERT OR REPLACE en tabla expenses', async () => {
    const expense = { id: 'exp-001', amount: 40 }
    await saveExpensesOffline('trip-001', 'user-abc', [expense])

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO expenses'),
      expect.arrayContaining(['exp-001', 'trip-001', 'user-abc'])
    )
  })
})

// ─── addPendingOperation ──────────────────────────────────────────────────────

describe('addPendingOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('inserta la operación con retries=0 y los campos correctos', async () => {
    await addPendingOperation('trips', 'update', 'trip-001', { title: 'Nuevo título' })

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pending_operations'),
      expect.arrayContaining(['trips', 'update', 'trip-001'])
    )

    // Verifica que retries=0 está hardcodeado en el SQL (no como parámetro)
    const callArgs = mockRunAsync.mock.calls[0] as [string, unknown[]]
    expect(callArgs[0]).toContain(', 0,')
  })

  it('no lanza error si getDb retorna null (plataforma web)', async () => {
    mockGetDb.mockResolvedValue(null)
    await expect(
      addPendingOperation('trips', 'delete', 'trip-001', {})
    ).resolves.toBeUndefined()
  })

  it('serializa el payload como JSON', async () => {
    const payload = { deleted_at: '2026-04-28T00:00:00Z', updated_at: '2026-04-28T00:00:00Z' }
    await addPendingOperation('trips', 'delete', 'trip-001', payload)

    const callArgs = mockRunAsync.mock.calls[0] as [string, unknown[]]
    const payloadArg = callArgs[1]?.[3] as string
    expect(JSON.parse(payloadArg)).toEqual(payload)
  })
})

// ─── syncPendingOperations ────────────────────────────────────────────────────

describe('syncPendingOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  it('retorna { synced: 0, failed: 0 } si no hay operaciones pendientes', async () => {
    mockGetAllAsync.mockResolvedValue([])
    const result = await syncPendingOperations()
    expect(result).toEqual({ synced: 0, failed: 0 })
  })

  it('consulta con LIMIT 10 (BATCH_SIZE) y retries < 3 (MAX_RETRIES)', async () => {
    mockGetAllAsync.mockResolvedValue([])
    await syncPendingOperations()

    const [query, params] = mockGetAllAsync.mock.calls[0] as [string, [number, number]]
    expect(query).toContain('retries < ?')
    expect(query).toContain('LIMIT ?')
    expect(params[0]).toBe(3)   // MAX_RETRIES
    expect(params[1]).toBe(10)  // BATCH_SIZE
  })

  it('incrementa retries cuando Supabase falla', async () => {
    // Supabase devuelve error para esta operación
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
      }),
    })
    mockGetAllAsync.mockResolvedValue([MOCK_PENDING_OP])

    const result = await syncPendingOperations()

    expect(result.failed).toBe(1)
    expect(result.synced).toBe(0)
    // Debe llamar UPDATE pending_operations SET retries = retries + 1
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('retries = retries + 1'),
      expect.arrayContaining([1])
    )
  })

  it('elimina la operación de la cola cuando Supabase tiene éxito', async () => {
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() =>
          vi.fn().mockResolvedValue({ error: null })()
        ),
      }),
    })
    // Mock para update con chain .eq().eq()
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate })

    mockGetAllAsync.mockResolvedValue([MOCK_PENDING_OP])

    const result = await syncPendingOperations()

    expect(result.synced).toBe(1)
    expect(mockRunAsync).toHaveBeenCalledWith(
      'DELETE FROM pending_operations WHERE id = ?',
      [MOCK_PENDING_OP.id]
    )
  })
})

// ─── countPendingOperations ───────────────────────────────────────────────────

describe('countPendingOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockResolvedValue(createFakeDb())
  })

  it('retorna el conteo de operaciones con retries < MAX_RETRIES', async () => {
    mockGetFirstAsync.mockResolvedValue({ count: 5 })
    const count = await countPendingOperations()
    expect(count).toBe(5)
  })

  it('retorna 0 si no hay operaciones pendientes', async () => {
    mockGetFirstAsync.mockResolvedValue({ count: 0 })
    const count = await countPendingOperations()
    expect(count).toBe(0)
  })

  it('retorna 0 si getDb retorna null (web)', async () => {
    mockGetDb.mockResolvedValue(null)
    const count = await countPendingOperations()
    expect(count).toBe(0)
  })

  it('retorna 0 si getFirstAsync falla', async () => {
    mockGetFirstAsync.mockRejectedValue(new Error('DB error'))
    const count = await countPendingOperations()
    expect(count).toBe(0)
  })
})
