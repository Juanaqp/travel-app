// Tipos del dominio de viajes — fuente de verdad para toda la app

export type TripStatus = 'planning' | 'confirmed' | 'active' | 'completed' | 'cancelled'

// Ritmo de viaje — refleja el enum SQL travel_pace
export type TravelPace = 'slow' | 'moderate' | 'intense'

// Nivel de presupuesto — refleja el enum SQL budget_tier
export type BudgetTier = 'budget' | 'mid' | 'premium' | 'luxury'

// Destino dentro de un viaje — se almacena como elemento de destinations JSONB
export interface Destination {
  city: string
  country: string
  countryCode?: string     // ISO 3166-1 alpha-2: 'FR', 'JP', 'ES'
  lat?: number
  lng?: number
  timezone?: string        // IANA timezone: 'Europe/Paris', 'Asia/Tokyo'
  arrivalDate?: string     // 'YYYY-MM-DD'
  departureDate?: string   // 'YYYY-MM-DD'
}

// Entidad Trip tal como viene de la base de datos
export interface Trip {
  id: string
  userId: string
  title: string
  description?: string
  coverImageUrl?: string
  status: TripStatus
  destinations: Destination[]
  startDate?: string       // 'YYYY-MM-DD'
  endDate?: string         // 'YYYY-MM-DD'
  travelersCount: number
  pace?: TravelPace
  budget?: BudgetTier
  baseCurrency: string     // ISO 4217: 'USD', 'EUR', 'GBP'
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

// Input de creación — sin campos generados por servidor
export interface CreateTripInput {
  title: string
  description?: string
  destinations: Destination[]
  startDate?: string
  endDate?: string
  travelersCount?: number
  pace?: TravelPace
  budget?: BudgetTier
  baseCurrency?: string
}

// Input de actualización — todos los campos opcionales excepto id
export interface UpdateTripInput {
  id: string
  title?: string
  description?: string
  destinations?: Destination[]
  startDate?: string
  endDate?: string
  travelersCount?: number
  pace?: TravelPace
  budget?: BudgetTier
  baseCurrency?: string
  status?: TripStatus
}
