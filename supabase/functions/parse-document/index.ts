// Edge Function: parse-document — parsea documentos de viaje con Claude Vision
// Implementación completa en Fase 6
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({ message: 'parse-document: pendiente de implementación' }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
