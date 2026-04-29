import { createClient } from 'npm:@supabase/supabase-js@2'
import { errorResponse } from '../_shared/errors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Solo se acepta POST', 405)
  }

  // Verificar autenticación mediante JWT del header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED', 'Se requiere autenticación', 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Cliente con service role para poder eliminar en tablas del sistema
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verificar el JWT y extraer el usuario
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

  if (authError || !user) {
    return errorResponse('UNAUTHORIZED', 'Token inválido o expirado', 401)
  }

  const userId = user.id

  // ─── Eliminación secuencial — orden importa por foreign keys ─────────────

  let currentStep = ''

  try {
    // 1. Archivos en Storage (documentos y portadas de viaje)
    currentStep = 'storage_documents'
    const { data: docFiles } = await adminClient.storage
      .from('documents')
      .list(`${userId}/`)
    if (docFiles && docFiles.length > 0) {
      const paths = docFiles.map((f) => `${userId}/${f.name}`)
      await adminClient.storage.from('documents').remove(paths)
    }

    currentStep = 'storage_trip_covers'
    const { data: coverFiles } = await adminClient.storage
      .from('trip-covers')
      .list(`${userId}/`)
    if (coverFiles && coverFiles.length > 0) {
      const paths = coverFiles.map((f) => `${userId}/${f.name}`)
      await adminClient.storage.from('trip-covers').remove(paths)
    }

    // 2. Tabla documents
    currentStep = 'table_documents'
    await adminClient
      .from('documents')
      .delete()
      .eq('user_id', userId)

    // 3. Tabla expenses
    currentStep = 'table_expenses'
    await adminClient
      .from('expenses')
      .delete()
      .eq('user_id', userId)

    // 4. Nodos de itinerario (si existe la tabla)
    currentStep = 'table_itinerary_nodes'
    await adminClient
      .from('itinerary_nodes')
      .delete()
      .eq('user_id', userId)

    // 5. Itinerarios
    currentStep = 'table_itineraries'
    await adminClient
      .from('itineraries')
      .delete()
      .eq('user_id', userId)

    // 6. Viajes
    currentStep = 'table_trips'
    await adminClient
      .from('trips')
      .delete()
      .eq('user_id', userId)

    // 7. Notificaciones
    currentStep = 'table_notifications'
    await adminClient
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    // 8. Feedback de IA
    currentStep = 'table_ai_feedback'
    await adminClient
      .from('ai_feedback')
      .delete()
      .eq('user_id', userId)

    // 9. Perfil en tabla users
    currentStep = 'table_users'
    await adminClient
      .from('users')
      .delete()
      .eq('id', userId)

    // 10. Usuario en auth.users (debe ser el último paso)
    currentStep = 'auth_user'
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteAuthError) throw deleteAuthError

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  } catch (error) {
    console.error(`[delete-account] Falló en paso "${currentStep}":`, error)
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al eliminar cuenta',
          step: currentStep,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})
