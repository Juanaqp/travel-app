// Edge Function: edit-node — edita un nodo del itinerario con Claude
// Implementación completa en Fase 4
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({ message: 'edit-node: pendiente de implementación' }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
