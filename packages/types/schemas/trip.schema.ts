import { z } from 'zod'

// Regex para validar fechas en formato 'YYYY-MM-DD'
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// Schema de un destino individual dentro del viaje
export const destinationSchema = z.object({
  city: z.string().min(1, 'La ciudad es obligatoria').max(100),
  country: z.string().min(1, 'El país es obligatorio').max(100),
  countryCode: z.string().length(2).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  timezone: z.string().optional(),
  arrivalDate: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  departureDate: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
})

// Schema de creación de viaje — se valida antes de insertar en Supabase
export const createTripInputSchema = z
  .object({
    title: z.string().min(1, 'El título es obligatorio').max(200),
    description: z.string().max(1000).optional(),
    destinations: z
      .array(destinationSchema)
      .min(1, 'Añade al menos un destino')
      .max(10, 'Máximo 10 destinos por viaje'),
    startDate: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
    endDate: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
    travelersCount: z.number().int().min(1).max(50).default(1),
    pace: z.enum(['slow', 'moderate', 'intense']).optional(),
    budget: z.enum(['budget', 'mid', 'premium', 'luxury']).optional(),
    baseCurrency: z.string().length(3, 'Código de moneda inválido (ISO 4217)').default('USD'),
  })
  .refine(
    (data) => {
      // Valida que la fecha de inicio no sea posterior a la fecha de fin
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate)
      }
      return true
    },
    {
      message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin',
      path: ['endDate'],
    }
  )

// Schema de actualización — todos los campos opcionales excepto id
export const updateTripInputSchema = z.object({
  id: z.string().uuid('ID de viaje inválido'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  destinations: z.array(destinationSchema).min(1).max(10).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  travelersCount: z.number().int().min(1).max(50).optional(),
  pace: z.enum(['slow', 'moderate', 'intense']).optional(),
  budget: z.enum(['budget', 'mid', 'premium', 'luxury']).optional(),
  baseCurrency: z.string().length(3).optional(),
  status: z.enum(['planning', 'confirmed', 'active', 'completed', 'cancelled']).optional(),
})

// Tipos inferidos de los schemas (para usarlos en Edge Functions con Deno)
export type CreateTripInputSchema = z.infer<typeof createTripInputSchema>
export type UpdateTripInputSchema = z.infer<typeof updateTripInputSchema>
export type DestinationSchema = z.infer<typeof destinationSchema>
