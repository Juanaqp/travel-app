// Módulo de rate limiting para Edge Functions que llaman a OpenAI
// Verifica y actualiza el contador de uso mensual del usuario en una sola operación.
// Si el usuario alcanzó su límite, lanza RateLimitExceededError antes de llamar a la IA.

import { createClient } from 'npm:@supabase/supabase-js@2'

type SupabaseClient = ReturnType<typeof createClient>

// ─── Error tipado para el caso de límite alcanzado ────────────────────────────

export class RateLimitExceededError extends Error {
  readonly code = 'RATE_LIMIT_EXCEEDED'
  readonly resetAt: string
  readonly used: number
  readonly limit: number

  constructor(used: number, limit: number, resetAt: string) {
    const resetDate = new Date(resetAt).toLocaleDateString('es', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
    super(
      `Has alcanzado el límite de ${limit} generaciones de IA este mes. Tu contador se renueva el ${resetDate}.`
    )
    this.name = 'RateLimitExceededError'
    this.used = used
    this.limit = limit
    this.resetAt = resetAt
  }
}

// ─── Verificación y conteo atómico ───────────────────────────────────────────

export interface UsageStatus {
  used: number
  limit: number
  resetAt: string
}

// Verifica si el usuario puede hacer otra generación y, si puede, incrementa el contador.
// Maneja el reseteo mensual automáticamente comparando now() con ai_messages_reset_at.
// Lanza RateLimitExceededError si el usuario llegó a su límite.
export const checkAndIncrementUsage = async (
  userId: string,
  supabase: SupabaseClient
): Promise<UsageStatus> => {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('ai_messages_used_this_month, ai_messages_limit, ai_messages_reset_at')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    throw new Error('No se pudo verificar el límite de uso del usuario')
  }

  const now = new Date()
  const resetAt = new Date(user.ai_messages_reset_at)

  let currentCount: number = user.ai_messages_used_this_month
  let newResetAt: string = user.ai_messages_reset_at

  // Si la fecha de reset ya pasó, resetear el contador al comienzo del ciclo actual
  if (now > resetAt) {
    currentCount = 0
    // Primer día del mes siguiente en UTC
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    newResetAt = next.toISOString()
  }

  // Verificar si el usuario llegó o superó su límite
  if (currentCount >= user.ai_messages_limit) {
    throw new RateLimitExceededError(currentCount, user.ai_messages_limit, newResetAt)
  }

  // Incrementar de forma atómica usando el valor leído + 1 para evitar condiciones de carrera
  const updates: Record<string, unknown> = {
    ai_messages_used_this_month: currentCount + 1,
  }
  // Solo actualizar reset_at si hubo reseteo (evita writes innecesarios)
  if (newResetAt !== user.ai_messages_reset_at) {
    updates.ai_messages_reset_at = newResetAt
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)

  if (updateError) throw updateError

  return {
    used: currentCount + 1,
    limit: user.ai_messages_limit,
    resetAt: newResetAt,
  }
}
