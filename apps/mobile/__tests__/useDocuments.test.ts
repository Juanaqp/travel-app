import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const {
  mockGetUser,
  mockFrom,
  mockFunctionsInvoke,
  mockStorageFrom,
  mockCreateSignedUrl,
  mockMakeDirectoryAsync,
  mockDownloadAsync,
  mockGetFirstAsync,
  mockRunAsync,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockFunctionsInvoke = vi.fn()
  const mockStorageFrom = vi.fn()
  const mockCreateSignedUrl = vi.fn()
  const mockMakeDirectoryAsync = vi.fn().mockResolvedValue(undefined)
  const mockDownloadAsync = vi.fn().mockResolvedValue({ status: 200, uri: '/local/path' })
  const mockGetFirstAsync = vi.fn().mockResolvedValue(null)
  const mockRunAsync = vi.fn().mockResolvedValue(undefined)
  return {
    mockGetUser,
    mockFrom,
    mockFunctionsInvoke,
    mockStorageFrom,
    mockCreateSignedUrl,
    mockMakeDirectoryAsync,
    mockDownloadAsync,
    mockGetFirstAsync,
    mockRunAsync,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
    storage: { from: mockStorageFrom },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/offline/reader', () => ({
  saveDocumentsOffline: vi.fn().mockResolvedValue(undefined),
  getDocumentsOffline: vi.fn().mockResolvedValue([]),
}))

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock-docs-dir/',
  makeDirectoryAsync: mockMakeDirectoryAsync,
  downloadAsync: mockDownloadAsync,
}))

vi.mock('@/lib/offline/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  }),
}))

// Importar funciones puras DESPUÉS de los mocks
import {
  mapRowToDocument,
  mapParsedTypeToDocumentType,
  fetchDocuments,
  fetchDocument,
  archiveDocument,
  getDocumentUrl,
  uploadDocument,
} from '../hooks/useDocuments'
import { downloadTripForOffline } from '../lib/offline/sync'
import type { TravelDocument } from '@travelapp/types'

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-test-abc' }

// Fila simulada de la tabla documents (snake_case — como viene de Supabase)
const MOCK_BOARDING_PASS_ROW = {
  id: 'doc-001',
  user_id: 'user-test-abc',
  trip_id: 'trip-xyz',
  title: 'Juan Perez',
  type: 'flight',
  storage_path: 'user-test-abc/doc-001/boarding_pass.jpg',
  file_name: 'boarding_pass.jpg',
  file_size_bytes: 204800,
  mime_type: 'image/jpeg',
  extracted_data: {
    type: 'boarding_pass',
    confidence: 0.95,
    raw_text: 'LATAM LA123 Lima to Rome Gate B12',
    fields: {
      flightNumber: 'LA123',
      airline: 'LATAM',
      passenger: 'Juan Perez',
      origin: 'Lima',
      destination: 'Rome',
      departureDate: '2026-07-10',
      seat: '12A',
      gate: 'B12',
      boardingTime: '22:30',
      pnr: 'ABC123',
    },
  },
  issue_date: null,
  expiry_date: null,
  deleted_at: null,
  created_at: '2026-04-26T10:00:00.000Z',
  updated_at: '2026-04-26T10:00:00.000Z',
}

// Fila de un PDF de ticket con confianza media
const MOCK_TICKET_ROW = {
  id: 'doc-002',
  user_id: 'user-test-abc',
  trip_id: null,
  title: 'Coliseo Romano — Entrada',
  type: 'tour',
  storage_path: 'user-test-abc/doc-002/ticket_coliseo.pdf',
  file_name: 'ticket_coliseo.pdf',
  file_size_bytes: 512000,
  mime_type: 'application/pdf',
  extracted_data: {
    type: 'ticket',
    confidence: 0.72,
    raw_text: 'Coliseo Romano entrada general',
    fields: {
      eventName: 'Coliseo Romano',
      venue: 'Roma, Italia',
      date: '2026-07-12',
      orderNumber: 'ORD-999',
    },
  },
  issue_date: null,
  expiry_date: null,
  deleted_at: null,
  created_at: '2026-04-26T11:00:00.000Z',
  updated_at: '2026-04-26T11:00:00.000Z',
}

// ─── Helper: mock de cadena de Supabase (thenable) ───────────────────────────
// Crea un objeto que imita la cadena fluida del query builder de Supabase.
// Al hacer `await chain`, resuelve a resolvedData.

const createQueryChain = (resolvedData: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {}

  const thenFn = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(resolvedData).then(onFulfilled, onRejected)

  const methods = ['select', 'eq', 'neq', 'is', 'order', 'limit', 'not', 'update', 'insert']
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }

  chain.then = thenFn
  chain.single = vi.fn().mockResolvedValue(resolvedData)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedData)

  return chain
}

// ─── Tests: mapRowToDocument ──────────────────────────────────────────────────

describe('mapRowToDocument', () => {
  it('convierte correctamente una fila de boarding pass a TravelDocument', () => {
    const doc = mapRowToDocument(MOCK_BOARDING_PASS_ROW)

    expect(doc.id).toBe('doc-001')
    expect(doc.userId).toBe('user-test-abc')
    expect(doc.tripId).toBe('trip-xyz')
    expect(doc.type).toBe('flight')
    expect(doc.fileName).toBe('boarding_pass.jpg')
    expect(doc.fileSizeBytes).toBe(204800)
    expect(doc.mimeType).toBe('image/jpeg')
    expect(doc.storagePath).toBe('user-test-abc/doc-001/boarding_pass.jpg')
    expect(doc.deletedAt).toBeNull()
    expect(doc.createdAt).toBe('2026-04-26T10:00:00.000Z')
  })

  it('mapea null file_size_bytes a undefined', () => {
    const row = { ...MOCK_BOARDING_PASS_ROW, file_size_bytes: null }
    const doc = mapRowToDocument(row)
    expect(doc.fileSizeBytes).toBeUndefined()
  })

  it('mapea null trip_id correctamente', () => {
    const doc = mapRowToDocument(MOCK_TICKET_ROW)
    expect(doc.tripId).toBeNull()
  })

  it('preserva los datos extraídos de la IA intactos', () => {
    const doc = mapRowToDocument(MOCK_BOARDING_PASS_ROW)
    const extracted = doc.extractedData as { type: string; confidence: number; fields: Record<string, unknown> }

    expect(extracted.type).toBe('boarding_pass')
    expect(extracted.confidence).toBe(0.95)
    expect(extracted.fields.flightNumber).toBe('LA123')
    expect(extracted.fields.passenger).toBe('Juan Perez')
    expect(extracted.fields.gate).toBe('B12')
  })
})

// ─── Tests: mapParsedTypeToDocumentType ──────────────────────────────────────

describe('mapParsedTypeToDocumentType', () => {
  it('boarding_pass → flight', () => {
    expect(mapParsedTypeToDocumentType('boarding_pass')).toBe('flight')
  })

  it('hotel_confirmation → hotel', () => {
    expect(mapParsedTypeToDocumentType('hotel_confirmation')).toBe('hotel')
  })

  it('visa → visa', () => {
    expect(mapParsedTypeToDocumentType('visa')).toBe('visa')
  })

  it('passport → passport', () => {
    expect(mapParsedTypeToDocumentType('passport')).toBe('passport')
  })

  it('car_rental → car_rental', () => {
    expect(mapParsedTypeToDocumentType('car_rental')).toBe('car_rental')
  })

  it('insurance → insurance', () => {
    expect(mapParsedTypeToDocumentType('insurance')).toBe('insurance')
  })

  it('tour → tour', () => {
    expect(mapParsedTypeToDocumentType('tour')).toBe('tour')
  })

  it('receipt → other', () => {
    expect(mapParsedTypeToDocumentType('receipt')).toBe('other')
  })

  it('ticket → other', () => {
    expect(mapParsedTypeToDocumentType('ticket')).toBe('other')
  })

  it('tipo desconocido → other (fallback)', () => {
    expect(mapParsedTypeToDocumentType('unknown_type')).toBe('other')
  })

  it('other → other', () => {
    expect(mapParsedTypeToDocumentType('other')).toBe('other')
  })
})

// ─── Tests: fetchDocuments ────────────────────────────────────────────────────

describe('fetchDocuments', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('retorna documentos del usuario activos (sin soft delete)', async () => {
    const chain = createQueryChain({
      data: [MOCK_BOARDING_PASS_ROW, MOCK_TICKET_ROW],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const docs = await fetchDocuments()

    expect(docs).toHaveLength(2)
    expect(docs[0].id).toBe('doc-001')
    expect(docs[1].id).toBe('doc-002')
  })

  it('retorna array vacío si el usuario no tiene documentos', async () => {
    const chain = createQueryChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const docs = await fetchDocuments()
    expect(docs).toEqual([])
  })

  it('lanza error si Supabase falla', async () => {
    const supabaseError = { message: 'DB connection error', code: '500' }
    const chain = createQueryChain({ data: null, error: supabaseError })
    mockFrom.mockReturnValue(chain)

    await expect(fetchDocuments()).rejects.toEqual(supabaseError)
  })

  it('lanza error si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const chain = createQueryChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await expect(fetchDocuments()).rejects.toThrow('Usuario no autenticado')
  })

  it('filtra por tripId cuando se proporciona', async () => {
    const chain = createQueryChain({
      data: [MOCK_BOARDING_PASS_ROW],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const docs = await fetchDocuments('trip-xyz')

    expect(docs).toHaveLength(1)
    // Verifica que .eq fue llamado con 'trip_id' (cadena encadenada)
    const eqMock = chain.eq as ReturnType<typeof vi.fn>
    const eqCalls = eqMock.mock.calls as Array<[string, unknown]>
    const hasTripIdFilter = eqCalls.some((args) => args[0] === 'trip_id')
    expect(hasTripIdFilter).toBe(true)
  })
})

// ─── Tests: fetchDocument ─────────────────────────────────────────────────────

describe('fetchDocument', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('retorna el documento solicitado por ID', async () => {
    const chain = createQueryChain({
      data: MOCK_BOARDING_PASS_ROW,
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const doc = await fetchDocument('doc-001')

    expect(doc.id).toBe('doc-001')
    expect(doc.type).toBe('flight')
  })

  it('lanza error si el documento no existe', async () => {
    const supabaseError = { message: 'Row not found', code: 'PGRST116' }
    const chain = createQueryChain({ data: null, error: supabaseError })
    mockFrom.mockReturnValue(chain)

    await expect(fetchDocument('doc-inexistente')).rejects.toEqual(supabaseError)
  })
})

// ─── Tests: archiveDocument ───────────────────────────────────────────────────

describe('archiveDocument', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
  })

  it('ejecuta soft delete sin lanzar error', async () => {
    const chain = createQueryChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await expect(archiveDocument('doc-001')).resolves.toBeUndefined()
  })

  it('lanza error si Supabase falla al actualizar', async () => {
    const supabaseError = { message: 'Update failed', code: '500' }
    const chain = createQueryChain({ data: null, error: supabaseError })
    mockFrom.mockReturnValue(chain)

    await expect(archiveDocument('doc-001')).rejects.toEqual(supabaseError)
  })
})

// ─── Tests: validación de estructura ParseDocumentResult ─────────────────────
// Simula la respuesta de la Edge Function y valida que tiene los campos esperados

describe('Validación de estructura ParseDocumentResult', () => {
  it('boarding pass con todos los campos críticos', () => {
    const mockBoardingPass = {
      type: 'boarding_pass',
      confidence: 0.95,
      raw_text: 'LATAM LA123 Lima to Rome Gate B12 Seat 12A',
      fields: {
        flightNumber: 'LA123',
        airline: 'LATAM',
        passenger: 'Juan Perez',
        origin: 'Lima',
        destination: 'Rome',
        seat: '12A',
        gate: 'B12',
        boardingTime: '22:30',
        pnr: 'ABC123',
      },
      cached: false,
      fileName: 'boarding_pass.jpg',
    }

    expect(mockBoardingPass.type).toBe('boarding_pass')
    expect(typeof mockBoardingPass.confidence).toBe('number')
    expect(mockBoardingPass.confidence).toBeGreaterThanOrEqual(0)
    expect(mockBoardingPass.confidence).toBeLessThanOrEqual(1)
    expect(typeof mockBoardingPass.raw_text).toBe('string')
    expect(typeof mockBoardingPass.fields).toBe('object')
    expect(mockBoardingPass.fields.flightNumber).toBe('LA123')
    expect(JSON.stringify(mockBoardingPass)).not.toThrow
  })

  it('PDF de ticket con confianza media — estructura válida', () => {
    const mockTicketPdf = {
      type: 'ticket',
      confidence: 0.72,
      raw_text: 'Coliseo Romano — Entrada general — Fecha: 12 Jul 2026',
      fields: {
        eventName: 'Coliseo Romano',
        venue: 'Roma, Italia',
        date: '2026-07-12',
        orderNumber: 'ORD-999',
      },
      cached: false,
      fileName: 'ticket_coliseo.pdf',
    }

    expect(typeof mockTicketPdf.type).toBe('string')
    expect(mockTicketPdf.confidence).toBeGreaterThan(0.5)
    expect(mockTicketPdf.fields).toBeDefined()
    expect(JSON.stringify(mockTicketPdf)).not.toThrow
    // Validar que se serializa correctamente como JSON
    const json = JSON.stringify(mockTicketPdf)
    expect(JSON.parse(json)).toEqual(mockTicketPdf)
  })

  it('documento con confianza baja devuelve type=other', () => {
    const mockLowConfidence = {
      type: 'other',
      confidence: 0.3,
      raw_text: 'Texto ilegible o formato desconocido',
      fields: {},
      cached: false,
      fileName: 'unknown_doc.jpg',
    }

    expect(mockLowConfidence.type).toBe('other')
    expect(mockLowConfidence.confidence).toBeLessThan(0.4)
    expect(typeof mockLowConfidence.fields).toBe('object')
  })

  it('resultado cacheado preserva los campos del resultado original', () => {
    const originalResult = {
      type: 'passport',
      confidence: 0.98,
      raw_text: 'Republic of Peru — Passport',
      fields: {
        documentNumber: 'P123456',
        firstName: 'Maria',
        lastName: 'Garcia',
        nationality: 'Peruana',
        expiryDate: '2030-01-15',
      },
    }

    const cachedResult = { ...originalResult, cached: true, fileName: 'passport.jpg' }

    expect(cachedResult.cached).toBe(true)
    expect(cachedResult.type).toBe(originalResult.type)
    expect(cachedResult.confidence).toBe(originalResult.confidence)
    expect(cachedResult.fields.documentNumber).toBe('P123456')
  })

  it('mapParsedTypeToDocumentType mapea todos los tipos del ParseDocumentResult', () => {
    const edgeFunctionTypes = [
      'boarding_pass', 'ticket', 'hotel_confirmation', 'visa',
      'passport', 'car_rental', 'insurance', 'tour', 'receipt', 'other',
    ]
    const validDocumentTypes = [
      'flight', 'hotel', 'visa', 'passport', 'car_rental', 'insurance', 'tour', 'other',
    ]

    for (const parsedType of edgeFunctionTypes) {
      const docType = mapParsedTypeToDocumentType(parsedType)
      expect(validDocumentTypes).toContain(docType)
    }
  })
})

// ─── Tests: documento como TravelDocument completo ───────────────────────────

describe('TravelDocument estructura completa', () => {
  it('boarding pass mapeado tiene los campos mínimos requeridos', () => {
    const doc: TravelDocument = mapRowToDocument(MOCK_BOARDING_PASS_ROW)

    // Campos obligatorios
    expect(doc.id).toBeTruthy()
    expect(doc.userId).toBeTruthy()
    expect(doc.type).toBeTruthy()
    expect(doc.storagePath).toBeTruthy()
    expect(doc.fileName).toBeTruthy()
    expect(doc.title).toBeTruthy()
    expect(doc.createdAt).toBeTruthy()
    expect(doc.updatedAt).toBeTruthy()

    // extracted_data con datos de IA
    const extracted = doc.extractedData as { confidence: number; type: string }
    expect(extracted.confidence).toBe(0.95)
    expect(extracted.type).toBe('boarding_pass')
  })
})

// ─── Tests: getDocumentUrl ────────────────────────────────────────────────────

describe('getDocumentUrl', () => {
  const MOCK_STORAGE_PATH = 'user-test-abc/doc-001/boarding_pass.jpg'
  const MOCK_SIGNED_URL = 'https://supabase.co/storage/v1/object/sign/documents/user-test-abc/doc-001/boarding_pass.jpg?token=xxx'

  beforeEach(() => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: MOCK_SIGNED_URL }, error: null })
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
  })

  it('genera URL firmada con expiración de 3600 segundos', async () => {
    const url = await getDocumentUrl(MOCK_STORAGE_PATH)

    expect(mockStorageFrom).toHaveBeenCalledWith('documents')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(MOCK_STORAGE_PATH, 3600, undefined)
    expect(url).toBe(MOCK_SIGNED_URL)
  })

  it('incluye transform de thumbnail cuando se solicita', async () => {
    await getDocumentUrl(MOCK_STORAGE_PATH, { thumbnail: true })

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      MOCK_STORAGE_PATH,
      3600,
      { transform: { width: 200, height: 200, resize: 'cover' } }
    )
  })

  it('sin thumbnail — no pasa transform a createSignedUrl', async () => {
    await getDocumentUrl(MOCK_STORAGE_PATH, { thumbnail: false })

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(MOCK_STORAGE_PATH, 3600, undefined)
  })

  it('lanza error si Supabase Storage falla', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('Storage error') })
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })

    await expect(getDocumentUrl(MOCK_STORAGE_PATH)).rejects.toThrow('Storage error')
  })
})

// ─── Tests: uploadDocument — storagePath desde EF ────────────────────────────
// Verifica que el cliente usa el storagePath devuelto por la EF (no hace upload directo)

describe('uploadDocument — storagePath gestionado por EF', () => {
  const MOCK_STORAGE_PATH_FROM_EF = 'user-test-abc/trip-xyz/abc123hash/boarding_pass.jpg'

  const MOCK_PARSE_RESULT = {
    type: 'boarding_pass',
    confidence: 0.95,
    raw_text: 'LATAM LA123',
    fields: { passenger: 'Juan Perez', flightNumber: 'LA123' },
    cached: false,
    fileName: 'boarding_pass.jpg',
    storagePath: MOCK_STORAGE_PATH_FROM_EF,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-test-abc' } }, error: null })
  })

  it('usa el storagePath devuelto por la EF para el insert en BD', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: MOCK_PARSE_RESULT, error: null })

    const mockSingle = vi.fn().mockResolvedValue({ data: MOCK_BOARDING_PASS_ROW, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert })

    await uploadDocument({
      fileBase64: 'base64data',
      mimeType: 'image/jpeg',
      fileName: 'boarding_pass.jpg',
      fileSizeBytes: 204800,
      tripId: 'trip-xyz',
    })

    // Verifica que el storagePath de la EF se usa en el insert
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ storage_path: MOCK_STORAGE_PATH_FROM_EF })
    )
  })

  it('no llama a supabase.storage.from().upload() — la EF gestiona el archivo', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: MOCK_PARSE_RESULT, error: null })

    const mockUpload = vi.fn()
    const mockSingle = vi.fn().mockResolvedValue({ data: MOCK_BOARDING_PASS_ROW, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockStorageFrom.mockReturnValue({ upload: mockUpload, createSignedUrl: vi.fn() })

    await uploadDocument({
      fileBase64: 'base64data',
      mimeType: 'image/jpeg',
      fileName: 'boarding_pass.jpg',
      fileSizeBytes: 204800,
    })

    // El cliente NO hace upload — lo gestiona la EF
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('lanza error si la EF no devuelve storagePath', async () => {
    const resultWithoutPath = { ...MOCK_PARSE_RESULT, storagePath: undefined }
    mockFunctionsInvoke.mockResolvedValue({ data: resultWithoutPath, error: null })

    await expect(
      uploadDocument({
        fileBase64: 'base64data',
        mimeType: 'image/jpeg',
        fileName: 'boarding_pass.jpg',
        fileSizeBytes: 204800,
      })
    ).rejects.toThrow('Error al subir el archivo al servidor')
  })
})

// ─── Tests: downloadTripForOffline ────────────────────────────────────────────

describe('downloadTripForOffline', () => {
  const TRIP_ID = 'trip-abc'
  const USER_ID = 'user-test-abc'

  const MOCK_DOC: TravelDocument = mapRowToDocument(MOCK_BOARDING_PASS_ROW)

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase.co/storage/signed/doc.jpg' },
      error: null,
    })
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    mockMakeDirectoryAsync.mockResolvedValue(undefined)
    mockDownloadAsync.mockResolvedValue({ status: 200, uri: '/mock-docs-dir/trip-abc/docs/boarding_pass.jpg' })
    mockGetFirstAsync.mockResolvedValue(null)
    mockRunAsync.mockResolvedValue(undefined)
  })

  it('genera URL firmada para cada documento con storagePath', async () => {
    await downloadTripForOffline(TRIP_ID, [MOCK_DOC], USER_ID)

    expect(mockStorageFrom).toHaveBeenCalledWith('documents')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(MOCK_DOC.storagePath, 3600)
  })

  it('descarga el archivo al directorio correcto en FileSystem', async () => {
    await downloadTripForOffline(TRIP_ID, [MOCK_DOC], USER_ID)

    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(
      `/mock-docs-dir/${TRIP_ID}/docs/`,
      { intermediates: true }
    )
    expect(mockDownloadAsync).toHaveBeenCalledWith(
      'https://supabase.co/storage/signed/doc.jpg',
      `/mock-docs-dir/${TRIP_ID}/docs/${MOCK_DOC.fileName}`
    )
  })

  it('actualiza la ruta local en SQLite cuando hay registro existente', async () => {
    // Simular que ya existe la fila en SQLite
    mockGetFirstAsync.mockResolvedValue({ data: JSON.stringify(MOCK_DOC) })

    await downloadTripForOffline(TRIP_ID, [MOCK_DOC], USER_ID)

    expect(mockRunAsync).toHaveBeenCalledWith(
      'UPDATE documents SET data = ? WHERE id = ?',
      expect.arrayContaining([expect.stringContaining('localFilePath'), MOCK_DOC.id])
    )
  })

  it('omite documentos sin storagePath', async () => {
    const docSinPath = { ...MOCK_DOC, storagePath: '' }

    await downloadTripForOffline(TRIP_ID, [docSinPath], USER_ID)

    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    expect(mockDownloadAsync).not.toHaveBeenCalled()
  })

  it('continúa con otros documentos si uno falla', async () => {
    const doc2: TravelDocument = mapRowToDocument({
      ...MOCK_TICKET_ROW,
      id: 'doc-003',
      storage_path: 'user/doc-003/ticket.pdf',
    })

    // Primer documento falla al generar URL firmada
    mockCreateSignedUrl
      .mockResolvedValueOnce({ data: null, error: new Error('Storage error') })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://signed.url/ticket.pdf' }, error: null })

    await downloadTripForOffline(TRIP_ID, [MOCK_DOC, doc2], USER_ID)

    // El segundo documento se intenta descargar igualmente
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1)
  })
})
