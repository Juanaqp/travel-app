// Tipos del dominio de itinerario — contrato central del sistema
// El grafo es la representación en memoria; se persiste completo cuando status === 'approved'

// Tipo del nodo — discriminante de la union y del enum SQL node_type
export type NodeType =
  | 'poi'
  | 'restaurant'
  | 'transport'
  | 'hotel_checkin'
  | 'activity'
  | 'free_time'
  | 'note'
  | 'flight'

// Estado del nodo tras revisión del usuario
export type NodeUserStatus = 'pending' | 'approved' | 'rejected' | 'modified'

// Estado del itinerario en su ciclo de vida
export type ItineraryStatus = 'draft' | 'reviewing' | 'approved' | 'saved'

// Ubicación geográfica de un nodo
export interface NodeLocation {
  address?: string
  lat?: number
  lng?: number
  placeId?: string    // Google Places ID para integración de mapas
}

// Coste estimado de un nodo
export interface NodeCost {
  amount?: number
  currency?: string   // ISO 4217
  isIncluded?: boolean  // ya incluido en un paquete o precio de entrada
}

// Campos compartidos por todos los tipos de nodo
// Exportado para que los componentes puedan tipar props de nodo genérico
export interface BaseNode {
  id: string
  type: NodeType
  dayId: string
  order: number           // posición dentro del día
  time: string            // 'HH:mm' en hora local del destino (para UI y edición)
  durationMinutes: number
  endTime: string         // calculado: time + durationMinutes
  // Campos de timezone — opcionales para compatibilidad con nodos existentes
  isoTime?: string        // ISO 8601 con offset: "2025-09-14T22:30:00-05:00"
  timezone?: string       // IANA timezone del nodo: "America/Lima"
  name: string
  description: string
  emoji: string
  aiTip: string           // consejo práctico generado por OpenAI
  location: NodeLocation
  cost: NodeCost
  userStatus: NodeUserStatus
  isAiGenerated: boolean
  isUserModified: boolean
  createdAt: string
}

// Punto de interés: museo, monumento, parque, mirador, etc.
export interface PoiNode extends BaseNode {
  type: 'poi'
  category?: string
  openingHours?: string
  rating?: number         // 0–5
}

// Restaurante, cafetería, bar, comida callejera
export interface RestaurantNode extends BaseNode {
  type: 'restaurant'
  cuisine?: string
  priceRange?: 1 | 2 | 3 | 4   // $ $$ $$$ $$$$
  reservationRequired?: boolean
  reservationUrl?: string
}

// Desplazamiento entre puntos: metro, taxi, a pie, ferry, etc.
export interface TransportNode extends BaseNode {
  type: 'transport'
  transportMode?: 'metro' | 'bus' | 'taxi' | 'walking' | 'ferry' | 'train' | 'car'
  fromLocation?: string
  toLocation?: string
  lineNumber?: string     // número de línea de metro o bus
}

// Check-in en alojamiento
export interface HotelCheckinNode extends BaseNode {
  type: 'hotel_checkin'
  hotelName?: string
  checkOutDate?: string   // 'YYYY-MM-DD'
  confirmationNumber?: string
}

// Actividad organizada: tour, clase de cocina, excursión, deporte
export interface ActivityNode extends BaseNode {
  type: 'activity'
  category?: string
  bookingRequired?: boolean
  bookingUrl?: string
}

// Bloque de tiempo libre con sugerencias opcionales
export interface FreeTimeNode extends BaseNode {
  type: 'free_time'
  suggestions?: string[]
}

// Nota informativa, aviso o consejo
export interface NoteNode extends BaseNode {
  type: 'note'
  noteType?: 'tip' | 'warning' | 'info'
}

// Vuelo entre ciudades
export interface FlightNode extends BaseNode {
  type: 'flight'
  flightNumber?: string
  airline?: string
  departureAirport?: string
  arrivalAirport?: string
  departureTime?: string
  arrivalTime?: string
  terminal?: string
  gate?: string
}

// Discriminated union completa por campo `type`
export type ItineraryNode =
  | PoiNode
  | RestaurantNode
  | TransportNode
  | HotelCheckinNode
  | ActivityNode
  | FreeTimeNode
  | NoteNode
  | FlightNode

// Arista del grafo — define la relación y orden entre nodos
export interface ItineraryEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  type: 'sequential' | 'transport' | 'optional'
  durationMinutes?: number
}

// Un día del itinerario con sus nodos ordenados
export interface ItineraryDay {
  id: string
  date: string            // 'YYYY-MM-DD'
  dayNumber: number       // 1-based
  title?: string          // ej. 'Día 1 — Llegada a París'
  destinationCity?: string
  nodeIds: string[]       // IDs de los nodos del día, en orden
}

// Metadatos del itinerario generado
export interface ItineraryMeta {
  totalDays: number
  totalNodes: number
  estimatedTotalCost?: number
  currency?: string
  generationDurationMs?: number
  version: string         // versión del schema de itinerario: '2.1.0'
}

// El grafo completo — unidad de persistencia cuando status === 'approved'
export interface ItineraryGraph {
  id: string
  tripId: string
  status: ItineraryStatus
  generatedBy: string     // modelo usado: 'gpt-4o-mini'
  userPrompt: string      // prompt original del usuario
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>  // mapa nodeId → nodo
  edges: ItineraryEdge[]
  meta: ItineraryMeta
  // IANA timezone del destino principal (ej: "Europe/Rome")
  destinationTimezone?: string
}

// ─── Helpers de timezone — usan Intl nativo, sin librerías externas ──────────

// Convierte una fecha ISO 8601 a 'HH:mm' en el timezone destino
export const convertToTimezone = (isoString: string, targetTz: string): string => {
  try {
    return new Intl.DateTimeFormat('es', {
      timeZone: targetTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoString))
  } catch {
    return isoString.slice(11, 16)  // fallback: extraer HH:mm del ISO string
  }
}

// Calcula el desfase de días entre la hora de origen y la hora en targetTz
// Devuelve 0, +1 o +2 (para mostrar badge "+1 día" en vuelos nocturnos)
export const getDayOffset = (isoString: string, originTz: string, targetTz: string): number => {
  try {
    const fmt = (tz: string) => new Intl.DateTimeFormat('es', {
      timeZone: tz, day: 'numeric', month: 'numeric', year: 'numeric',
    }).format(new Date(isoString))
    const originDate = fmt(originTz)
    const targetDate = fmt(targetTz)
    if (originDate === targetDate) return 0
    // Calcular diferencia en días comparando timestamps
    const toMs = (tz: string) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date(isoString))
      const m = Object.fromEntries(parts.map(p => [p.type, p.value]))
      return Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day))
    }
    const diff = Math.round((toMs(targetTz) - toMs(originTz)) / 86_400_000)
    return diff
  } catch {
    return 0
  }
}

// Formatea la hora de un nodo para mostrar al usuario en el timezone activo.
// Si el nodo tiene isoTime usa conversión precisa; si no, usa el campo time (HH:mm).
export const formatNodeTime = (node: BaseNode, displayTimezone?: string): string => {
  if (node.isoTime) {
    const tz = displayTimezone ?? node.timezone
    if (tz) return convertToTimezone(node.isoTime, tz)
    return node.isoTime.slice(11, 16)  // extraer HH:mm del ISO
  }
  return node.time
}
