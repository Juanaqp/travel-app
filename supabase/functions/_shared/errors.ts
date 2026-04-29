// Respuestas de error estandarizadas para todas las Edge Functions
// Formato: { error: { code, message } } — consistente en toda la API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Códigos de error semánticos — permiten al cliente distinguir el tipo de fallo
export type ErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA'
  | 'METHOD_NOT_ALLOWED'
  | 'AI_UNAVAILABLE'
  | 'MISSING_CONFIG'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'

// Construye una respuesta de error HTTP con estructura consistente
export const errorResponse = (
  code: ErrorCode,
  message: string,
  status: number
): Response =>
  new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  )
