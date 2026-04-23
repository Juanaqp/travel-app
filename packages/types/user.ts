// Tipos del dominio de usuario — extiende el perfil de Supabase Auth

// Plan de suscripción — refleja el enum SQL user_plan
export type UserPlan = 'free' | 'pro' | 'team'

// Límites de mensajes de IA por plan
export const AI_MESSAGE_LIMITS: Record<UserPlan, number> = {
  free: 20,
  pro: 200,
  team: 500,
}

// Perfil extendido del usuario — tabla public.users
export interface UserProfile {
  id: string               // mismo UUID que auth.users.id
  email: string
  fullName?: string
  avatarUrl?: string
  plan: UserPlan

  // Contador de rate-limiting para la IA
  aiMessagesUsedThisMonth: number
  aiMessagesLimit: number
  aiMessagesResetAt: string  // ISO datetime: primer día del mes siguiente

  // Preferencias
  preferredCurrency: string  // ISO 4217: 'USD', 'EUR'
  preferredLanguage: string  // ISO 639-1: 'es', 'en'

  // Timestamps
  createdAt: string
  updatedAt: string
}

// Input para actualizar el perfil del usuario (no se puede cambiar id o email)
export interface UpdateUserProfileInput {
  fullName?: string
  avatarUrl?: string
  preferredCurrency?: string
  preferredLanguage?: string
}
