// Edge Function: parse-expense — parsea tickets y facturas con Claude Vision
// Implementación completa en Fase 5
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({ message: 'parse-expense: pendiente de implementación' }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
