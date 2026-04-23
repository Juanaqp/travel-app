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
  time: string            // 'HH:mm' en hora local del destino
  durationMinutes: number
  endTime: string         // calculado: time + durationMinutes
  name: string
  description: string
  emoji: string
  aiTip: string           // consejo práctico generado por Claude
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
  generatedBy: string     // modelo usado: 'claude-sonnet-4-5'
  userPrompt: string      // prompt original del usuario
  days: ItineraryDay[]
  nodes: Record<string, ItineraryNode>  // mapa nodeId → nodo
  edges: ItineraryEdge[]
  meta: ItineraryMeta
}
