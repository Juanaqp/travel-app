import { z } from 'zod'

// Schema Zod para validar el JSON del itinerario generado por Claude.
// Se usa en la Edge Function generate-itinerary antes de persistir el grafo.
// Claude genera IDs como strings cortos (no necesariamente UUIDs).

// Regex para hora en formato 'HH:mm'
const timeRegex = /^\d{2}:\d{2}$/

// Regex para fecha en formato 'YYYY-MM-DD'
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// Sub-schemas comunes

const nodeCostSchema = z.object({
  amount: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  isIncluded: z.boolean().optional(),
})

const nodeLocationSchema = z.object({
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
})

// Campos base comunes a todos los tipos de nodo
// No incluye `type` — cada subschema lo añade como literal para discriminatedUnion
const baseNodeSchema = z.object({
  id: z.string().min(1),
  dayId: z.string().min(1),
  order: z.number().int().min(0),
  time: z.string().regex(timeRegex, 'Formato de hora inválido (HH:mm)'),
  durationMinutes: z.number().int().min(1),
  endTime: z.string().regex(timeRegex, 'Formato de hora inválido (HH:mm)'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  emoji: z.string().max(10).default('📍'),
  aiTip: z.string().max(500).default(''),
  location: nodeLocationSchema,
  cost: nodeCostSchema,
  userStatus: z.enum(['pending', 'approved', 'rejected', 'modified']).default('pending'),
  isAiGenerated: z.boolean().default(true),
  isUserModified: z.boolean().default(false),
  createdAt: z.string().datetime(),
})

// Schemas específicos por tipo de nodo

const poiNodeSchema = baseNodeSchema.extend({
  type: z.literal('poi'),
  category: z.string().optional(),
  openingHours: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
})

const restaurantNodeSchema = baseNodeSchema.extend({
  type: z.literal('restaurant'),
  cuisine: z.string().optional(),
  priceRange: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  reservationRequired: z.boolean().optional(),
  reservationUrl: z.string().url().optional(),
})

const transportNodeSchema = baseNodeSchema.extend({
  type: z.literal('transport'),
  transportMode: z.enum(['metro', 'bus', 'taxi', 'walking', 'ferry', 'train', 'car']).optional(),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  lineNumber: z.string().optional(),
})

const hotelCheckinNodeSchema = baseNodeSchema.extend({
  type: z.literal('hotel_checkin'),
  hotelName: z.string().optional(),
  checkOutDate: z.string().regex(dateRegex).optional(),
  confirmationNumber: z.string().optional(),
})

const activityNodeSchema = baseNodeSchema.extend({
  type: z.literal('activity'),
  category: z.string().optional(),
  bookingRequired: z.boolean().optional(),
  bookingUrl: z.string().url().optional(),
})

const freeTimeNodeSchema = baseNodeSchema.extend({
  type: z.literal('free_time'),
  suggestions: z.array(z.string()).optional(),
})

const noteNodeSchema = baseNodeSchema.extend({
  type: z.literal('note'),
  noteType: z.enum(['tip', 'warning', 'info']).optional(),
})

const flightNodeSchema = baseNodeSchema.extend({
  type: z.literal('flight'),
  flightNumber: z.string().optional(),
  airline: z.string().optional(),
  departureAirport: z.string().optional(),
  arrivalAirport: z.string().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  terminal: z.string().optional(),
  gate: z.string().optional(),
})

// Discriminated union — Zod valida el tipo correcto según el campo `type`
export const itineraryNodeSchema = z.discriminatedUnion('type', [
  poiNodeSchema,
  restaurantNodeSchema,
  transportNodeSchema,
  hotelCheckinNodeSchema,
  activityNodeSchema,
  freeTimeNodeSchema,
  noteNodeSchema,
  flightNodeSchema,
])

const itineraryEdgeSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  type: z.enum(['sequential', 'transport', 'optional']),
  durationMinutes: z.number().int().min(0).optional(),
})

const itineraryDaySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)'),
  dayNumber: z.number().int().min(1),
  title: z.string().max(200).optional(),
  destinationCity: z.string().optional(),
  nodeIds: z.array(z.string().min(1)),
})

const itineraryMetaSchema = z.object({
  totalDays: z.number().int().min(1),
  totalNodes: z.number().int().min(0),
  estimatedTotalCost: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  generationDurationMs: z.number().int().optional(),
  version: z.string(),
})

// Schema completo del ItineraryGraph — valida el JSON antes de persistir
export const itineraryGraphSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().uuid('tripId debe ser un UUID válido'),
  status: z.enum(['draft', 'reviewing', 'approved', 'saved']),
  generatedBy: z.string().min(1),
  userPrompt: z.string().min(10, 'El prompt debe tener al menos 10 caracteres'),
  days: z.array(itineraryDaySchema).min(1, 'El itinerario debe tener al menos un día'),
  nodes: z.record(z.string(), itineraryNodeSchema),
  edges: z.array(itineraryEdgeSchema),
  meta: itineraryMetaSchema,
})

// Tipos inferidos — para usar en Edge Functions con Deno sin importar los tipos manuales
export type ItineraryGraphSchema = z.infer<typeof itineraryGraphSchema>
export type ItineraryNodeSchema = z.infer<typeof itineraryNodeSchema>
export type ItineraryDaySchema = z.infer<typeof itineraryDaySchema>
