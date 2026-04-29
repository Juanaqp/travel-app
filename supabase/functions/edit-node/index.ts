// Edge Function: edit-node
// POST /functions/v1/edit-node
// Edita un nodo del itinerario usando OpenAI según una instrucción del usuario.
// Devuelve solo el nodo modificado, actualiza el grafo en BD y recalcula edges del día.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { errorResponse } from '../_shared/errors.ts'
import { checkAndIncrementUsage, RateLimitExceededError } from '../_shared/rateLimiter.ts'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODEL = 'gpt-4o-mini'
const MAX_OUTPUT_TOKENS = 2000
const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const TIMEOUT_MS = 30_000

// ─── Schema de entrada ────────────────────────────────────────────────────────
// Soporta dos modos:
//   saved: itineraryId + nodeId → carga nodo desde BD, guarda resultado en BD
//   draft: nodeData + nodeId → usa datos proporcionados directamente, sin BD

const requestSchema = z.object({
  itineraryId: z.string().uuid().optional(),
  nodeId: z.string().min(1),
  instruction: z.string().min(5).max(500),
  nodeData: z.record(z.unknown()).optional(),
})

// ─── Schema simplificado del nodo (subset mínimo para validar la respuesta) ──

const timeRe = /^\d{2}:\d{2}$/

const editedNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['poi', 'restaurant', 'transport', 'hotel_checkin', 'activity', 'free_time', 'note', 'flight']),
  dayId: z.string().min(1),
  order: z.number().int().min(0),
  time: z.string().regex(timeRe),
  durationMinutes: z.number().int().min(1),
  endTime: z.string().regex(timeRe),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  emoji: z.string().max(10).default('📍'),
  aiTip: z.string().max(500).default(''),
  location: z.record(z.unknown()).default({}),
  cost: z.record(z.unknown()).default({}),
  userStatus: z.literal('modified'),
  isAiGenerated: z.boolean(),
  isUserModified: z.literal(true),
  createdAt: z.string(),
}).passthrough()

// ─── CORS headers ─────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

// ─── Tipo del grafo almacenado en BD ──────────────────────────────────────────
// Solo los campos que necesitamos para editar un nodo

interface StoredGraph {
  days: Array<{ id: string; nodeIds: string[] }>
  nodes: Record<string, unknown>
  edges: Array<{ id: string; fromNodeId: string; toNodeId: string; type: string; durationMinutes?: number }>
  [key: string]: unknown
}

// ─── Recalcula edges secuenciales para el día del nodo editado ────────────────

const rebuildDayEdges = (
  graph: StoredGraph,
  dayId: string
): StoredGraph['edges'] => {
  // Null-safety: days y edges pueden ser null/undefined en grafos guardados con versiones anteriores
  const days = Array.isArray(graph.days) ? graph.days : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []

  const day = days.find((d) => d.id === dayId)
  if (!day) return edges

  const dayNodeSet = new Set(day.nodeIds)

  // Preservar edges no secuenciales o que no pertenecen a este día
  const preserved = edges.filter(
    (e) =>
      e.type !== 'sequential' ||
      !dayNodeSet.has(e.fromNodeId) ||
      !dayNodeSet.has(e.toNodeId)
  )

  // Reconstruir edges secuenciales en el orden actual del día
  const newEdges: StoredGraph['edges'] = []
  for (let i = 0; i < day.nodeIds.length - 1; i++) {
    const fromId = day.nodeIds[i]
    const toId = day.nodeIds[i + 1]
    if (fromId && toId && graph.nodes[fromId] && graph.nodes[toId]) {
      newEdges.push({
        id: `edge-${fromId}-${toId}`,
        fromNodeId: fromId,
        toNodeId: toId,
        type: 'sequential',
      })
    }
  }

  return [...preserved, ...newEdges]
}

// ─── Llamada a OpenAI ─────────────────────────────────────────────────────────

const callOpenAI = async (
  apiKey: string,
  currentNodeJson: string,
  instruction: string,
  signal: AbortSignal
): Promise<unknown> => {
  const systemPrompt = `Eres un editor de nodos de itinerario de viaje. Recibirás un nodo en JSON y una instrucción de modificación.

CRÍTICO: Tu tarea es devolver SOLO el objeto JSON del nodo modificado. Sin texto, sin markdown, sin explicaciones.

REGLAS:
- NO cambies los campos: id, dayId, order, isAiGenerated, createdAt
- SÍ actualiza: name, description, emoji, aiTip, cost, location, time, durationMinutes, endTime y campos específicos del tipo
- Si cambias time o durationMinutes, recalcula endTime correctamente (HH:MM + minutos)
- Siempre establece: userStatus = "modified", isUserModified = true
- Mantén el mismo "type" del nodo original
- Responde ÚNICAMENTE con el JSON del nodo modificado`

  const userPrompt = `Nodo actual:\n${currentNodeJson}\n\nInstrucción: ${instruction}\n\nDevuelve el nodo modificado como JSON.`

  const url = `${OPENAI_BASE_URL}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
    signal,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`OpenAI respondió con status ${res.status}: ${errorText}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? ''

  if (!rawText) throw new Error('OpenAI respondió con contenido vacío')

  // Extraer JSON del texto (por si hay texto extra)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  const cleanJson = jsonMatch ? jsonMatch[0] : rawText

  return JSON.parse(cleanJson)
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // 1. Validar entrada
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Body JSON inválido' }, 400)
    }

    const parseResult = requestSchema.safeParse(body)
    if (!parseResult.success) {
      return jsonResponse(
        { error: 'Datos de entrada inválidos', details: parseResult.error.flatten() },
        422
      )
    }
    const { itineraryId, nodeId, instruction, nodeData } = parseResult.data

    // Requiere itineraryId (modo guardado) o nodeData (modo draft)
    if (!itineraryId && !nodeData) {
      return jsonResponse({ error: 'Se requiere itineraryId o nodeData' }, 422)
    }

    const isDraftMode = !itineraryId && !!nodeData
    console.log(`[edit-node] Paso 1 OK — modo=${isDraftMode ? 'draft' : 'saved'} nodeId=${nodeId}`)

    // 2. Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[edit-node] Paso 2 FALLO — authError:', authError?.message)
      return jsonResponse({ error: 'No autorizado' }, 401)
    }
    console.log(`[edit-node] Paso 2 OK — userId=${user.id}`)

    // 3. Verificar límite de uso de IA antes de llamar a OpenAI
    try {
      await checkAndIncrementUsage(user.id, supabase)
    } catch (rateLimitErr) {
      clearTimeout(timeoutId)
      if (rateLimitErr instanceof RateLimitExceededError) {
        return errorResponse('RATE_LIMIT_EXCEEDED', rateLimitErr.message, 429)
      }
      throw rateLimitErr
    }

    // 4. Obtener el nodo a editar (desde BD o desde nodeData directo)
    let currentNode: unknown
    let graph: StoredGraph | null = null

    if (isDraftMode) {
      // Modo draft: usar nodeData directamente sin BD
      currentNode = nodeData
      console.log(`[edit-node] Paso 3 OK — nodo obtenido de nodeData (draft)`)
    } else {
      // Modo guardado: cargar desde BD
      const { data: itineraryRow, error: fetchError } = await supabase
        .from('itineraries')
        .select('id, graph')
        .eq('id', itineraryId!)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()

      if (fetchError || !itineraryRow) {
        console.error('[edit-node] Paso 3 FALLO — fetchError:', fetchError?.message, fetchError?.code)
        return jsonResponse({ error: 'Itinerario no encontrado o sin permisos' }, 404)
      }
      console.log(`[edit-node] Paso 3 OK — itinerario cargado`)

      graph = itineraryRow.graph as StoredGraph

      if (!graph || typeof graph !== 'object' || !graph.nodes || typeof graph.nodes !== 'object') {
        console.error('[edit-node] Paso 3b FALLO — graph inválido:', JSON.stringify(graph).slice(0, 200))
        return jsonResponse({ error: 'El grafo del itinerario tiene un formato inválido' }, 422)
      }

      currentNode = graph.nodes[nodeId]
      if (!currentNode) {
        console.error(`[edit-node] Paso 4 FALLO — nodo "${nodeId}" no encontrado. Nodos disponibles: ${Object.keys(graph.nodes).join(', ')}`)
        return jsonResponse({ error: `Nodo "${nodeId}" no encontrado en el itinerario` }, 404)
      }
    }
    console.log(`[edit-node] Paso 4 OK — nodo encontrado`)

    // 5. Verificar API key de OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('[edit-node] Paso 5 FALLO — OPENAI_API_KEY no configurada')
      return jsonResponse({ error: 'OPENAI_API_KEY no configurada en el servidor' }, 500)
    }
    console.log(`[edit-node] Paso 5 OK — API key presente`)

    // 6. Llamar a OpenAI para modificar el nodo
    console.log(`[edit-node] Paso 6 — llamando a OpenAI...`)
    const currentNodeJson = JSON.stringify(currentNode, null, 2)
    const editedNodeRaw = await callOpenAI(openaiApiKey, currentNodeJson, instruction, controller.signal)
    console.log(`[edit-node] Paso 6 OK — respuesta de OpenAI recibida`)

    // 7. Validar que la respuesta cumple el schema mínimo
    const validation = editedNodeSchema.safeParse(editedNodeRaw)
    if (!validation.success) {
      console.error('[edit-node] Paso 7 FALLO — schema inválido:', JSON.stringify(validation.error.flatten()))
      return jsonResponse(
        { error: 'La IA devolvió un nodo inválido', details: validation.error.flatten() },
        422
      )
    }
    console.log(`[edit-node] Paso 7 OK — nodo validado`)

    const editedNode = validation.data

    // 8. Asegurar que el nodeId no fue alterado por la IA
    if (editedNode.id !== nodeId) {
      console.error(`[edit-node] Paso 8 FALLO — ID alterado: esperado=${nodeId} recibido=${editedNode.id}`)
      return jsonResponse({ error: 'La IA intentó cambiar el ID del nodo' }, 422)
    }

    // 9. En modo draft, devolver solo el nodo editado (sin persistir)
    if (isDraftMode) {
      clearTimeout(timeoutId)
      console.log(`[edit-node] Completado en modo draft — nodeId=${nodeId}`)
      return jsonResponse(editedNode, 200)
    }

    // 10. Reemplazar nodo en el grafo y recalcular edges del día (modo guardado)
    const updatedNodes = { ...graph!.nodes, [nodeId]: editedNode }
    const updatedEdges = rebuildDayEdges(
      { days: graph!.days ?? [], edges: graph!.edges ?? [], nodes: updatedNodes },
      editedNode.dayId
    )
    const updatedGraph = { ...graph!, nodes: updatedNodes, edges: updatedEdges }
    console.log(`[edit-node] Paso 9 OK — grafo actualizado en memoria`)

    // 11. Persistir grafo actualizado en BD
    const { error: updateError } = await supabase
      .from('itineraries')
      .update({ graph: updatedGraph })
      .eq('id', itineraryId!)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[edit-node] Paso 11 FALLO — updateError:', updateError.message, updateError.code)
      return jsonResponse({ error: 'No se pudo guardar el nodo editado' }, 500)
    }

    clearTimeout(timeoutId)
    console.log(`[edit-node] Completado exitosamente — nodeId=${nodeId}`)
    return jsonResponse(editedNode, 200)
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      return jsonResponse({ error: 'Timeout: la IA tardó demasiado en responder' }, 503)
    }
    if (error instanceof SyntaxError) {
      console.error('[edit-node] SyntaxError al parsear JSON de OpenAI:', error.message)
      return jsonResponse({ error: 'La IA devolvió JSON inválido' }, 422)
    }
    // Error de la API de OpenAI (fallo HTTP, clave inválida, cuota agotada, contenido vacío, etc.)
    if (error instanceof Error && error.message.startsWith('OpenAI respondió')) {
      console.error('[edit-node] Error de OpenAI:', error.message)
      return jsonResponse({ error: error.message }, 503)
    }

    const errDetail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error('[edit-node] Error inesperado:', errDetail)
    // Temporalmente incluir el detalle del error para diagnóstico
    return jsonResponse({ error: `Error interno: ${errDetail}` }, 500)
  }
})
