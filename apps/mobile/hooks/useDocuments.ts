import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useToastStore } from '@/stores/useToastStore'
import { saveDocumentsOffline, getDocumentsOffline } from '@/lib/offline/reader'
import type {
  TravelDocument,
  DocumentType,
  ParseDocumentResult,
  UploadDocumentInput,
  DocumentExtractedData,
} from '@travelapp/types'

// ─── Tipo fila de BD (snake_case → camelCase) ─────────────────────────────────

type DocumentRow = {
  id: string
  user_id: string
  trip_id: string | null
  title: string
  type: string
  storage_path: string
  file_name: string
  file_size_bytes: number | null
  mime_type: string | null
  extracted_data: Record<string, unknown>
  issue_date: string | null
  expiry_date: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Convierte fila snake_case de BD al tipo camelCase del dominio
export const mapRowToDocument = (row: DocumentRow): TravelDocument => ({
  id: row.id,
  userId: row.user_id,
  tripId: row.trip_id,
  title: row.title,
  type: row.type as DocumentType,
  storagePath: row.storage_path,
  fileName: row.file_name,
  fileSizeBytes: row.file_size_bytes ?? undefined,
  mimeType: row.mime_type ?? undefined,
  extractedData: row.extracted_data,
  issueDate: row.issue_date ?? undefined,
  expiryDate: row.expiry_date ?? undefined,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// Mapea el tipo detectado por OpenAI al enum document_type de la BD
export const mapParsedTypeToDocumentType = (parsedType: string): DocumentType => {
  const mapping: Record<string, DocumentType> = {
    boarding_pass: 'flight',
    ticket: 'other',
    hotel_confirmation: 'hotel',
    visa: 'visa',
    passport: 'passport',
    car_rental: 'car_rental',
    insurance: 'insurance',
    tour: 'tour',
    receipt: 'other',
    other: 'other',
  }
  return mapping[parsedType] ?? 'other'
}

// Obtiene el usuario autenticado o lanza excepción
const getAuthenticatedUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user
}

const DOCS_QUERY_KEY = 'documents' as const

// ─── Funciones puras de BD — testeables ──────────────────────────────────────

// Obtiene documentos del usuario, opcionalmente filtrados por viaje
// Guarda en caché offline para uso sin conexión (solo cuando hay tripId)
export const fetchDocuments = async (tripId?: string): Promise<TravelDocument[]> => {
  const user = await getAuthenticatedUser()

  let query = supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (tripId) {
    query = query.eq('trip_id', tripId)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Error al obtener documentos', { error, userId: user.id, tripId })
    // Intentar retornar datos offline si hay tripId y falla la red
    if (tripId) {
      const offlineData = await getDocumentsOffline(tripId)
      if (offlineData.length > 0) {
        logger.info('Retornando documentos desde caché offline', { count: offlineData.length })
        return offlineData as TravelDocument[]
      }
    }
    throw error
  }

  const documents = (data as DocumentRow[]).map(mapRowToDocument)
  // Actualizar caché offline en background (solo si hay tripId)
  if (tripId) {
    saveDocumentsOffline(tripId, user.id, documents).catch(() => {})
  }
  return documents
}

// Obtiene un documento específico por ID
export const fetchDocument = async (id: string): Promise<TravelDocument> => {
  const user = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (error) {
    logger.error('Error al obtener documento', { error, documentId: id })
    throw error
  }

  return mapRowToDocument(data as DocumentRow)
}

// Genera URL firmada de Supabase Storage con expiración de 1 hora
// Con opción de thumbnail (200x200 vía Supabase image transform — sin subida extra)
export const getDocumentUrl = async (
  storagePath: string,
  options?: { thumbnail?: boolean }
): Promise<string> => {
  const transform = options?.thumbnail
    ? { width: 200, height: 200, resize: 'cover' as const }
    : undefined

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600, transform ? { transform } : undefined)

  if (error) {
    logger.error('Error al generar URL firmada del documento', { error, storagePath })
    throw error
  }

  return data.signedUrl
}

// Archiva un documento vía soft delete — nunca borrado físico
export const archiveDocument = async (documentId: string): Promise<void> => {
  const user = await getAuthenticatedUser()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', documentId)
    .eq('user_id', user.id)

  if (error) {
    logger.error('Error al archivar documento', { error, documentId })
    throw error
  }
}

// Flujo completo: parsear con IA → (Storage gestionado por la EF) → guardar en BD
// La Edge Function sube el archivo a Storage y devuelve storagePath en la respuesta.
export const uploadDocument = async (input: UploadDocumentInput): Promise<TravelDocument> => {
  const user = await getAuthenticatedUser()

  // Paso 1: parsear el documento con OpenAI via Edge Function
  // La EF también sube el archivo a Storage y devuelve storagePath
  const { data: parseData, error: parseError } = await supabase.functions.invoke<ParseDocumentResult>(
    'parse-document',
    {
      body: {
        fileBase64: input.fileBase64,
        mimeType: input.mimeType,
        fileName: input.fileName,
        tripId: input.tripId,
      },
    }
  )

  if (parseError || !parseData) {
    logger.error('Error al parsear documento con IA', {
      error: parseError,
      fileName: input.fileName,
    })
    throw parseError ?? new Error('Sin datos de parseo de la Edge Function')
  }

  if (!parseData.storagePath) {
    logger.error('La Edge Function no devolvió storagePath', { fileName: input.fileName })
    throw new Error('Error al subir el archivo al servidor')
  }

  // Paso 2: inferir título desde campos extraídos según tipo de documento
  const fields = parseData.fields ?? {}
  const title =
    (fields.passenger as string) ||
    (fields.holderName as string) ||
    (fields.hotelName as string) ||
    (fields.eventName as string) ||
    (fields.tourName as string) ||
    input.fileName

  // Paso 3: guardar solo datos estructurados en extracted_data (sin metadatos de caché)
  const extractedData: DocumentExtractedData = {
    type: parseData.type,
    confidence: parseData.confidence,
    raw_text: parseData.raw_text,
    fields: parseData.fields,
  }

  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      trip_id: input.tripId ?? null,
      title,
      type: mapParsedTypeToDocumentType(parseData.type),
      storage_path: parseData.storagePath,
      file_name: input.fileName,
      file_size_bytes: input.fileSizeBytes,
      mime_type: input.mimeType,
      extracted_data: extractedData,
    })
    .select()
    .single()

  if (insertError) {
    logger.error('Error al guardar documento en BD', { error: insertError, storagePath: parseData.storagePath })
    throw insertError
  }

  logger.info('Documento subido y procesado correctamente', {
    type: parseData.type,
    confidence: parseData.confidence,
    storagePath: parseData.storagePath,
    cached: parseData.cached,
  })

  return mapRowToDocument(data as DocumentRow)
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export const useDocuments = (tripId?: string) =>
  useQuery({
    queryKey: tripId ? [DOCS_QUERY_KEY, 'trip', tripId] : [DOCS_QUERY_KEY],
    queryFn: () => fetchDocuments(tripId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

export const useDocument = (id: string) =>
  useQuery({
    queryKey: [DOCS_QUERY_KEY, id],
    queryFn: () => fetchDocument(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

// Hook para obtener la URL firmada de un documento (se refresca antes de expirar)
export const useDocumentUrl = (storagePath: string | undefined, thumbnail = false) =>
  useQuery({
    queryKey: [DOCS_QUERY_KEY, 'url', storagePath, thumbnail],
    queryFn: () => getDocumentUrl(storagePath!, { thumbnail }),
    enabled: !!storagePath,
    staleTime: 50 * 60 * 1000,  // 50 min — URL expira a los 60 min
    retry: 1,
  })

export const useUploadDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: [DOCS_QUERY_KEY] })
      if (doc.tripId) {
        queryClient.invalidateQueries({ queryKey: [DOCS_QUERY_KEY, 'trip', doc.tripId] })
      }
      logger.info('Documento cargado — caché invalidado')
    },
    onError: (error) => {
      logger.error('Mutation de subir documento falló', { error })
      useToastStore.getState().showToast('No se pudo procesar el documento. Inténtalo de nuevo.', 'error')
    },
  })
}

export const useDeleteDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCS_QUERY_KEY] })
      logger.info('Documento eliminado — caché invalidado')
    },
    onError: (error) => {
      logger.error('Mutation de eliminar documento falló', { error })
      useToastStore.getState().showToast('No se pudo eliminar el documento.', 'error')
    },
  })
}
