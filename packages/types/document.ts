// Tipos del dominio de documentos de viaje

// Tipo de documento — refleja el enum SQL document_type
export type DocumentType =
  | 'passport'
  | 'visa'
  | 'flight'
  | 'hotel'
  | 'insurance'
  | 'car_rental'
  | 'tour'
  | 'other'

// Metadatos extraídos de documentos de vuelo por parse-document Edge Function
export interface FlightExtractedData {
  flightNumber?: string
  airline?: string
  origin?: string
  destination?: string
  departureTime?: string
  arrivalTime?: string
  terminal?: string
  seat?: string
  pnr?: string             // localizador de reserva
}

// Metadatos extraídos de pasaporte o DNI
export interface PassportExtractedData {
  documentNumber?: string
  nationality?: string
  firstName?: string
  lastName?: string
  birthDate?: string       // 'YYYY-MM-DD'
  expiryDate?: string      // 'YYYY-MM-DD'
  gender?: string
}

// Metadatos extraídos de confirmación de hotel
export interface HotelExtractedData {
  hotelName?: string
  checkInDate?: string     // 'YYYY-MM-DD'
  checkOutDate?: string    // 'YYYY-MM-DD'
  roomType?: string
  confirmationNumber?: string
  address?: string
}

// Metadatos extraídos de visado
export interface VisaExtractedData {
  visaNumber?: string
  country?: string
  validFrom?: string       // 'YYYY-MM-DD'
  validUntil?: string      // 'YYYY-MM-DD'
  entries?: 'single' | 'multiple'
}

// Datos extraídos por la Edge Function parse-document — estructura normalizada
export interface DocumentExtractedData {
  type: string
  confidence: number
  raw_text: string
  fields: Record<string, string | number | null>
}

// Unión de todos los tipos de metadatos posibles
export type ExtractedData =
  | DocumentExtractedData
  | FlightExtractedData
  | PassportExtractedData
  | HotelExtractedData
  | VisaExtractedData
  | Record<string, unknown>

// Resultado completo retornado por la Edge Function parse-document
export interface ParseDocumentResult {
  type: string
  confidence: number
  raw_text: string
  fields: Record<string, string | number | null>
  cached: boolean
  fileName: string
  tripId?: string
  storagePath?: string   // ruta en Storage donde se guardó el archivo (incluido en dedup por hash)
}

// Input para la mutation de subida y procesamiento de documento
export interface UploadDocumentInput {
  tripId?: string
  fileName: string
  mimeType: string
  fileBase64: string
  fileSizeBytes: number
}

// Entidad TravelDocument tal como viene de la base de datos
export interface TravelDocument {
  id: string
  userId: string
  tripId?: string | null
  title: string
  type: DocumentType
  storagePath: string        // ruta relativa en Supabase Storage
  fileName: string
  fileSizeBytes?: number
  mimeType?: string
  extractedData: ExtractedData
  issueDate?: string         // 'YYYY-MM-DD'
  expiryDate?: string        // 'YYYY-MM-DD'
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

// Input de creación — los metadatos se rellenan por la Edge Function parse-document
export interface CreateDocumentInput {
  tripId?: string
  title: string
  type: DocumentType
  storagePath: string
  fileName: string
  fileSizeBytes?: number
  mimeType?: string
}
