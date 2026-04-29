// Tipos para la pantalla Explorar y sus Edge Functions

export type Continent =
  | 'Europe'
  | 'Asia'
  | 'Americas'
  | 'Africa'
  | 'Oceania'
  | 'Middle East'

// Un destino popular obtenido de get-explore-feed
export interface ExploreDestination {
  name: string
  trip_count: number
  image_url: string
  continent: Continent
}

// Respuesta completa de la Edge Function get-explore-feed
export interface ExploreFeedResponse {
  destinations: ExploreDestination[]
  generated_at: string
}

// Información detallada de un destino devuelta por get-destination-info
export interface DestinationInfo {
  best_months: string[]
  avg_budget_per_day_usd: number
  recommended_days: number
  highlights: string[]
  cuisine: string[]
  tips: string[]
  timezone: string
  currency: string
  language: string
  cached?: boolean
}
