// Punto de entrada del paquete @travelapp/types
// Importar desde aquí en toda la app: import type { Trip } from '@travelapp/types'

export * from './trip'
export * from './user'
export * from './expense'
export * from './document'
export * from './itinerary'

// Schemas Zod — para validación en Edge Functions y formularios
export * from './schemas/trip.schema'
export * from './schemas/itinerary.schema'

// packages/types/database.ts no se exporta aquí — es generado por Supabase CLI
// Ejecutar: supabase gen types typescript --local > packages/types/database.ts
