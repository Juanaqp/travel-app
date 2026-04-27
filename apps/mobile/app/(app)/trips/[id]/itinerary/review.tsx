import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useItineraryStore } from '@/stores/useItineraryStore'
import { useApproveItinerary } from '@/hooks/useApproveItinerary'
import { editNode } from '@/hooks/useEditNode'
import { ItineraryNodeCard, TransferBadge } from '@/components/ItineraryNodeCard'
import { Button } from '@/components/Button'
import { logger } from '@/lib/logger'
import type { ItineraryNode, TransportNode } from '@travelapp/types'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface EditNodeForm {
  name: string
  time: string
  durationMinutes: string
}

const EMPTY_EDIT_FORM: EditNodeForm = {
  name: '',
  time: '',
  durationMinutes: '',
}

// ─── Modal de edición manual de nodo ─────────────────────────────────────────

interface EditNodeModalProps {
  node: ItineraryNode | null
  form: EditNodeForm
  onChange: (field: keyof EditNodeForm, value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

const EditNodeModal = ({ node, form, onChange, onConfirm, onCancel }: EditNodeModalProps) => {
  if (!node) return null

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <View className="rounded-t-2xl border-t border-slate-700 bg-slate-900 px-5 pb-10 pt-5">
          {/* Handle de arrastre */}
          <View className="mb-4 self-center">
            <View className="h-1 w-10 rounded-full bg-slate-600" />
          </View>

          <Text className="mb-5 text-lg font-bold text-white">Editar actividad</Text>

          {/* Nombre */}
          <Text className="mb-1.5 text-sm font-medium text-slate-300">Nombre</Text>
          <View className="mb-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
            <TextInput
              value={form.name}
              onChangeText={(v) => onChange('name', v)}
              placeholder={node.name}
              placeholderTextColor="#64748b"
              maxLength={200}
              accessibilityLabel="Nombre de la actividad"
              style={{ color: '#f1f5f9', fontSize: 15 }}
            />
          </View>

          {/* Hora y duración en fila */}
          <View className="mb-6 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1.5 text-sm font-medium text-slate-300">Hora (HH:mm)</Text>
              <View className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
                <TextInput
                  value={form.time}
                  onChangeText={(v) => onChange('time', v)}
                  placeholder={node.time}
                  placeholderTextColor="#64748b"
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Hora de la actividad"
                  style={{ color: '#f1f5f9', fontSize: 15 }}
                />
              </View>
            </View>
            <View className="flex-1">
              <Text className="mb-1.5 text-sm font-medium text-slate-300">
                Duración (min)
              </Text>
              <View className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
                <TextInput
                  value={form.durationMinutes}
                  onChangeText={(v) => onChange('durationMinutes', v)}
                  placeholder={String(node.durationMinutes)}
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel="Duración en minutos"
                  style={{ color: '#f1f5f9', fontSize: 15 }}
                />
              </View>
            </View>
          </View>

          {/* Acciones */}
          <View className="gap-3">
            <Button
              label="Confirmar cambios"
              onPress={onConfirm}
              variant="primary"
              accessibilityLabel="Confirmar edición del nodo"
            />
            <Button
              label="Cancelar"
              onPress={onCancel}
              variant="ghost"
              accessibilityLabel="Cancelar edición"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Modal de edición asistida por IA (draft) ─────────────────────────────────

interface AIEditModalProps {
  node: ItineraryNode | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  onSubmit: (instruction: string) => void
}

const AIEditModal = ({ node, isLoading, error, onClose, onSubmit }: AIEditModalProps) => {
  const [instruction, setInstruction] = useState('')

  if (!node) return null

  const handleSubmit = () => {
    if (instruction.trim().length < 5) return
    onSubmit(instruction.trim())
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end bg-black/60"
        onPress={onClose}
        accessibilityLabel="Cerrar modal"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => {}} className="rounded-t-2xl bg-slate-800 p-6">
            <View className="mb-4 flex-row items-center gap-2">
              <Text className="text-lg font-bold text-white">✨ Editar con IA</Text>
            </View>

            {/* Resumen del nodo actual */}
            <View className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <Text className="text-xs text-slate-500">Nodo a modificar</Text>
              <Text className="mt-0.5 font-semibold text-white">
                {node.emoji} {node.name}
              </Text>
              <Text className="text-xs text-slate-500">
                {node.time} · {node.durationMinutes} min
              </Text>
            </View>

            {/* Instrucción para la IA */}
            <Text className="mb-2 text-xs font-semibold text-slate-400">
              ¿Qué quieres cambiar? *
            </Text>
            <View className="mb-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <TextInput
                value={instruction}
                onChangeText={setInstruction}
                placeholder="Ej: cámbialo por algo más barato, añade el horario real, actualiza la descripción..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                maxLength={500}
                editable={!isLoading}
                style={{ color: '#f1f5f9', fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>
            <Text className="mb-4 text-right text-xs text-slate-600">
              {instruction.length}/500
            </Text>

            {/* Error de la IA */}
            {error ? (
              <View className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2">
                <Text className="text-xs text-red-400">{error}</Text>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                disabled={isLoading}
                className="flex-1 items-center rounded-xl bg-slate-700 py-3 active:bg-slate-600 disabled:opacity-50"
              >
                <Text className="font-semibold text-white">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading || instruction.trim().length < 5}
                className="flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="font-semibold text-white">Procesando...</Text>
                  </View>
                ) : (
                  <Text className="font-semibold text-white">✨ Aplicar cambio</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Pantalla de revisión ─────────────────────────────────────────────────────

export default function ReviewItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const draftGraph = useItineraryStore((s) => s.draftGraph)
  const updateNode = useItineraryStore((s) => s.updateNode)
  const { mutateAsync: approve, isPending: isApproving, error: approveError } = useApproveItinerary()

  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditNodeForm>(EMPTY_EDIT_FORM)
  const [aiEditingNode, setAiEditingNode] = useState<ItineraryNode | null>(null)
  const [aiEditError, setAiEditError] = useState<string | null>(null)
  const [isAiEditing, setIsAiEditing] = useState(false)

  // Sin draft — redirigir a la pantalla de generación
  if (!draftGraph) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="mb-3 text-4xl" accessibilityElementsHidden>
          😕
        </Text>
        <Text className="mb-2 text-center text-lg font-bold text-white">
          No hay itinerario para revisar
        </Text>
        <Text className="mb-6 text-center text-sm text-slate-400">
          Genera un itinerario primero para poder revisarlo.
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver a generar itinerario"
        >
          <Text className="text-indigo-400">← Volver a generar</Text>
        </Pressable>
      </View>
    )
  }

  const activeDay = draftGraph.days[activeDayIndex]
  if (!activeDay) return null

  // Nodos del día activo en orden, ignorando IDs que no existan en el mapa
  const activeNodes = activeDay.nodeIds
    .map((nodeId) => draftGraph.nodes[nodeId])
    .filter((n): n is ItineraryNode => n !== undefined)

  // Mapa de aristas para mostrar tiempos de tránsito entre nodos consecutivos
  // Clave: "fromNodeId→toNodeId"
  const edgeByPair = new Map(
    draftGraph.edges.map((e) => [`${e.fromNodeId}→${e.toNodeId}`, e])
  )

  // Costo total estimado (excluye nodos rechazados)
  const totalCost = Object.values(draftGraph.nodes)
    .filter((n) => n.userStatus !== 'rejected')
    .reduce((sum, n) => sum + (n.cost.amount ?? 0), 0)

  const currency = draftGraph.meta.currency ?? 'EUR'

  // Nodo que está siendo editado actualmente
  const editingNode = editingNodeId ? draftGraph.nodes[editingNodeId] ?? null : null

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleApproveNode = (nodeId: string) => {
    updateNode(nodeId, (n) => ({ ...n, userStatus: 'approved' as const }))
  }

  const handleRejectNode = (nodeId: string) => {
    updateNode(nodeId, (n) => ({ ...n, userStatus: 'rejected' as const }))
  }

  const handleOpenEdit = (node: ItineraryNode) => {
    setEditForm({
      name: node.name,
      time: node.time,
      durationMinutes: String(node.durationMinutes),
    })
    setEditingNodeId(node.id)
  }

  const handleConfirmEdit = () => {
    if (!editingNodeId) return

    updateNode(editingNodeId, (node) => {
      const parsedDuration = parseInt(editForm.durationMinutes, 10)
      return {
        ...node,
        name: editForm.name.trim() || node.name,
        time: editForm.time.trim() || node.time,
        durationMinutes: !isNaN(parsedDuration) && parsedDuration > 0
          ? parsedDuration
          : node.durationMinutes,
        userStatus: 'modified' as const,
        isUserModified: true,
      }
    })

    setEditingNodeId(null)
    setEditForm(EMPTY_EDIT_FORM)
  }

  const handleAIEditSubmit = async (instruction: string) => {
    if (!aiEditingNode) return
    setIsAiEditing(true)
    setAiEditError(null)
    try {
      const updatedNode = await editNode({
        nodeId: aiEditingNode.id,
        instruction,
        nodeData: aiEditingNode,
      })
      updateNode(updatedNode.id, () => updatedNode)
      setAiEditingNode(null)
      logger.info('Nodo del draft editado con IA', { nodeId: updatedNode.id })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al editar con IA'
      setAiEditError(msg)
      logger.error('Error al editar nodo del draft con IA', { err, nodeId: aiEditingNode.id })
    } finally {
      setIsAiEditing(false)
    }
  }

  const handleApproveItinerary = async () => {
    if (!id) return
    try {
      await approve({ tripId: id, draftGraph })
      router.replace(`/(app)/trips/${id}` as never)
    } catch (err) {
      // El error queda en approveError para mostrarlo en la UI
      logger.error('Error al aprobar itinerario desde la pantalla de revisión', { err })
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center border-b border-slate-700 px-4 pb-4 pt-12">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          className="mr-3 rounded-lg p-1 active:bg-slate-800"
        >
          <Text className="text-2xl text-slate-400">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xs text-slate-500">Revisión del itinerario</Text>
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {draftGraph.userPrompt.slice(0, 60)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-slate-500">
            {draftGraph.meta.totalDays} días ·{' '}
            {draftGraph.meta.totalNodes} actividades
          </Text>
        </View>
      </View>

      {/* Tabs de días */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {draftGraph.days.map((day, index) => {
          const isActive = index === activeDayIndex
          return (
            <Pressable
              key={day.id}
              onPress={() => setActiveDayIndex(index)}
              accessibilityRole="tab"
              accessibilityLabel={`Día ${day.dayNumber}`}
              accessibilityState={{ selected: isActive }}
              className={`rounded-full px-4 py-2 ${
                isActive ? 'bg-indigo-500' : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}
              >
                Día {day.dayNumber}
              </Text>
              {day.destinationCity ? (
                <Text
                  className={`text-xs ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}
                  numberOfLines={1}
                >
                  {day.destinationCity}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Lista de nodos del día activo */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Título del día */}
        {activeDay.title ? (
          <Text className="mb-3 text-sm font-semibold text-slate-400">
            {activeDay.title}
          </Text>
        ) : null}

        {activeNodes.length === 0 ? (
          <View className="mt-8 items-center">
            <Text className="text-4xl" accessibilityElementsHidden>
              📭
            </Text>
            <Text className="mt-2 text-slate-400">
              No hay actividades para este día
            </Text>
          </View>
        ) : null}

        {activeNodes.map((node, idx) => {
          const prevNode = idx > 0 ? activeNodes[idx - 1] : null
          const edgeFromPrev =
            prevNode ? edgeByPair.get(`${prevNode.id}→${node.id}`) : undefined

          // Los nodos de transporte se renderizan como TransferBadge
          if (node.type === 'transport') {
            return (
              <TransferBadge key={node.id} node={node as TransportNode} />
            )
          }

          return (
            <View key={node.id}>
              {/* Badge de tiempo de tránsito si hay arista secuencial con duración */}
              {edgeFromPrev && edgeFromPrev.durationMinutes && edgeFromPrev.type !== 'transport' ? (
                <View className="flex-row items-center justify-center py-1">
                  <View className="h-px flex-1 bg-slate-800" />
                  <Text className="mx-2 text-xs text-slate-600">
                    {edgeFromPrev.durationMinutes} min →
                  </Text>
                  <View className="h-px flex-1 bg-slate-800" />
                </View>
              ) : (
                <View className="h-2" />
              )}

              <ItineraryNodeCard
                node={node}
                onApprove={() => handleApproveNode(node.id)}
                onReject={() => handleRejectNode(node.id)}
                onEdit={() => handleOpenEdit(node)}
                onAIEdit={() => { setAiEditError(null); setAiEditingNode(node) }}
              />
            </View>
          )
        })}

        {/* Espaciado inferior para que el último nodo no quede tapado por la barra */}
        <View className="h-4" />
      </ScrollView>

      {/* Barra inferior fija */}
      <View className="border-t border-slate-700 bg-slate-900 px-4 pb-6 pt-4">
        {/* Error de aprobación */}
        {approveError ? (
          <Text className="mb-3 text-center text-xs text-red-400">
            ❌ {(approveError as Error).message ?? 'Error al guardar el itinerario'}
          </Text>
        ) : null}

        {/* Costo total */}
        {totalCost > 0 ? (
          <Text className="mb-3 text-center text-sm text-slate-400">
            Costo estimado:{' '}
            <Text className="font-semibold text-white">
              {currency} {Math.round(totalCost)}
            </Text>
          </Text>
        ) : null}

        <View className="flex-row gap-3">
          {/* Regenerar — vuelve a la pantalla de generación */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver a regenerar itinerario"
            className="flex-1 items-center rounded-xl border border-slate-600 bg-slate-800 py-3 active:bg-slate-700"
          >
            <Text className="text-sm font-semibold text-slate-300">🔄 Regenerar</Text>
          </Pressable>

          {/* Aprobar itinerario */}
          <Pressable
            onPress={handleApproveItinerary}
            disabled={isApproving}
            accessibilityRole="button"
            accessibilityLabel="Aprobar y guardar itinerario"
            className={`flex-1 items-center rounded-xl bg-indigo-500 py-3 active:bg-indigo-600 ${
              isApproving ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <Text className="text-sm font-semibold text-white">
              {isApproving ? 'Guardando...' : '✓ Aprobar itinerario'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Modal de edición manual */}
      {editingNode ? (
        <EditNodeModal
          node={editingNode}
          form={editForm}
          onChange={(field, value) =>
            setEditForm((prev) => ({ ...prev, [field]: value }))
          }
          onConfirm={handleConfirmEdit}
          onCancel={() => {
            setEditingNodeId(null)
            setEditForm(EMPTY_EDIT_FORM)
          }}
        />
      ) : null}

      {/* Modal de edición con IA */}
      {aiEditingNode ? (
        <AIEditModal
          node={aiEditingNode}
          isLoading={isAiEditing}
          error={aiEditError}
          onClose={() => { setAiEditingNode(null); setAiEditError(null) }}
          onSubmit={handleAIEditSubmit}
        />
      ) : null}
    </View>
  )
}
