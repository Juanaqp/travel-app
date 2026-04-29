import { useState, useCallback } from 'react'
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
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useLocalSearchParams, router } from 'expo-router'
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist'
import { useItinerary } from '@/hooks/useItinerary'
import { useUpdateItinerary } from '@/hooks/useUpdateItinerary'
import { useEditNode } from '@/hooks/useEditNode'
import { ItineraryNodeCard, TransferBadge } from '@/components/ItineraryNodeCard'
import { DayRouteCard } from '@/components/DayRouteCard'
import {
  calculateEndTime,
  DEFAULT_NODE_EMOJI,
  reorderDayNodes,
} from '@/lib/reorderNodes'
import type { ItineraryNode, ItineraryDay, NodeType, TransportNode } from '@travelapp/types'

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const ADD_NODE_TYPES: { type: NodeType; label: string }[] = [
  { type: 'poi', label: 'Lugar' },
  { type: 'restaurant', label: 'Restaurante' },
  { type: 'activity', label: 'Actividad' },
  { type: 'transport', label: 'Transporte' },
  { type: 'hotel_checkin', label: 'Hotel' },
  { type: 'note', label: 'Nota' },
]

// ─── Sub-componente: modal de edición manual de nodo ─────────────────────────

interface EditNodeModalProps {
  node: ItineraryNode | null
  isSaving: boolean
  onClose: () => void
  onSave: (updates: { name: string; time: string; durationMinutes: number; description: string }) => void
}

const EditNodeModal = ({ node, isSaving, onClose, onSave }: EditNodeModalProps) => {
  const [name, setName] = useState(node?.name ?? '')
  const [time, setTime] = useState(node?.time ?? '')
  const [duration, setDuration] = useState(String(node?.durationMinutes ?? ''))
  const [description, setDescription] = useState(node?.description ?? '')

  if (!node) return null

  const handleSave = () => {
    const parsedDuration = parseInt(duration, 10)
    if (!name.trim() || !time.match(/^\d{2}:\d{2}$/) || isNaN(parsedDuration)) return
    onSave({ name: name.trim(), time, durationMinutes: parsedDuration, description })
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
            <Text className="mb-4 text-lg font-bold text-white">Editar actividad</Text>

            <Text className="mb-1 text-xs font-semibold text-slate-400">Nombre</Text>
            <View className="mb-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nombre de la actividad"
                placeholderTextColor="#64748b"
                style={{ color: '#f1f5f9', fontSize: 14 }}
              />
            </View>

            <View className="mb-3 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-slate-400">Hora (HH:MM)</Text>
                <View className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                  <TextInput
                    value={time}
                    onChangeText={setTime}
                    placeholder="09:00"
                    placeholderTextColor="#64748b"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    style={{ color: '#f1f5f9', fontSize: 14 }}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-slate-400">Duración (min)</Text>
                <View className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                  <TextInput
                    value={duration}
                    onChangeText={setDuration}
                    placeholder="60"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    maxLength={4}
                    style={{ color: '#f1f5f9', fontSize: 14 }}
                  />
                </View>
              </View>
            </View>

            <Text className="mb-1 text-xs font-semibold text-slate-400">Descripción</Text>
            <View className="mb-5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Descripción opcional"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={2}
                style={{ color: '#f1f5f9', fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
              />
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                className="flex-1 items-center rounded-xl bg-slate-700 py-3 active:bg-slate-600"
              >
                <Text className="font-semibold text-white">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className="flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Guardar</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Sub-componente: modal para añadir nodo manualmente ──────────────────────

interface AddNodeModalProps {
  visible: boolean
  days: ItineraryDay[]
  currentDayId: string
  isSaving: boolean
  onClose: () => void
  onAdd: (node: ItineraryNode) => void
}

const AddNodeModal = ({
  visible,
  days,
  currentDayId,
  isSaving,
  onClose,
  onAdd,
}: AddNodeModalProps) => {
  const [selectedDayId, setSelectedDayId] = useState(currentDayId)
  const [selectedType, setSelectedType] = useState<NodeType>('poi')
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')

  const handleAdd = () => {
    const parsedDuration = parseInt(duration, 10)
    if (!name.trim() || !time.match(/^\d{2}:\d{2}$/) || isNaN(parsedDuration)) return

    const newNode = {
      id: `node-${Date.now()}`,
      type: selectedType,
      dayId: selectedDayId,
      order: 999,
      time,
      durationMinutes: parsedDuration,
      endTime: calculateEndTime(time, parsedDuration),
      name: name.trim(),
      description: '',
      emoji: DEFAULT_NODE_EMOJI[selectedType],
      aiTip: '',
      location: {},
      cost: {},
      userStatus: 'approved' as const,
      isAiGenerated: false,
      isUserModified: false,
      createdAt: new Date().toISOString(),
    } as ItineraryNode

    onAdd(newNode)
    setName('')
    setTime('')
    setDuration('60')
    setSelectedType('poi')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end bg-black/60"
        onPress={onClose}
        accessibilityLabel="Cerrar modal"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => {}} className="rounded-t-2xl bg-slate-800 p-6">
            <Text className="mb-4 text-lg font-bold text-white">Añadir actividad</Text>

            {/* Selector de día */}
            {days.length > 1 ? (
              <View className="mb-4">
                <Text className="mb-2 text-xs font-semibold text-slate-400">Día</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {days.map((day) => (
                      <Pressable
                        key={day.id}
                        onPress={() => setSelectedDayId(day.id)}
                        className={`rounded-lg border px-3 py-1.5 ${
                          selectedDayId === day.id
                            ? 'border-indigo-500 bg-indigo-950'
                            : 'border-slate-600 bg-slate-700'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            selectedDayId === day.id ? 'text-indigo-300' : 'text-slate-300'
                          }`}
                        >
                          {day.title ?? `Día ${day.dayNumber}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            {/* Tipo de nodo */}
            <Text className="mb-2 text-xs font-semibold text-slate-400">Tipo</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {ADD_NODE_TYPES.map((opt) => (
                <Pressable
                  key={opt.type}
                  onPress={() => setSelectedType(opt.type)}
                  className={`rounded-lg border px-3 py-1.5 ${
                    selectedType === opt.type
                      ? 'border-indigo-500 bg-indigo-950'
                      : 'border-slate-600 bg-slate-700'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selectedType === opt.type ? 'text-indigo-300' : 'text-slate-300'
                    }`}
                  >
                    {DEFAULT_NODE_EMOJI[opt.type]} {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Nombre */}
            <Text className="mb-1 text-xs font-semibold text-slate-400">Nombre *</Text>
            <View className="mb-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nombre de la actividad"
                placeholderTextColor="#64748b"
                style={{ color: '#f1f5f9', fontSize: 14 }}
              />
            </View>

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-slate-400">Hora * (HH:MM)</Text>
                <View className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                  <TextInput
                    value={time}
                    onChangeText={setTime}
                    placeholder="10:00"
                    placeholderTextColor="#64748b"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    style={{ color: '#f1f5f9', fontSize: 14 }}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-slate-400">Duración (min)</Text>
                <View className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                  <TextInput
                    value={duration}
                    onChangeText={setDuration}
                    placeholder="60"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    maxLength={4}
                    style={{ color: '#f1f5f9', fontSize: 14 }}
                  />
                </View>
              </View>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                className="flex-1 items-center rounded-xl bg-slate-700 py-3 active:bg-slate-600"
              >
                <Text className="font-semibold text-white">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                disabled={isSaving || !name.trim()}
                className="flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Añadir</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Sub-componente: modal de edición asistida por IA ────────────────────────

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
                className="flex-2 flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
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

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const tripId = id ?? ''

  const { data: itinerary, isLoading, error, refetch } = useItinerary(tripId)
  const updateMutation = useUpdateItinerary(tripId)
  const editNodeMutation = useEditNode(tripId)

  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [editingNode, setEditingNode] = useState<ItineraryNode | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [aiEditingNode, setAiEditingNode] = useState<ItineraryNode | null>(null)
  const [aiEditError, setAiEditError] = useState<string | null>(null)

  // Nodos del día seleccionado — excluye rechazados, en orden
  const selectedDay = itinerary?.graph.days[selectedDayIndex]
  const dayNodes: ItineraryNode[] = selectedDay
    ? (selectedDay.nodeIds
        .map((nodeId) => itinerary?.graph.nodes[nodeId])
        .filter(
          (node): node is ItineraryNode => !!node && node.userStatus !== 'rejected'
        ))
    : []

  // ─── Handler de reorden por drag & drop ──────────────────────────────────

  const handleDragEnd = useCallback(
    ({ data }: { data: ItineraryNode[] }) => {
      if (!itinerary || !selectedDay) return
      const newNodeIds = data.map((n) => n.id)
      const updatedGraph = reorderDayNodes(itinerary.graph, selectedDay.id, newNodeIds)
      updateMutation.mutate({ itineraryId: itinerary.id, tripId, graph: updatedGraph })
    },
    [itinerary, selectedDay, tripId, updateMutation]
  )

  // ─── Handler de edición manual ────────────────────────────────────────────

  const handleSaveEdit = useCallback(
    (updates: { name: string; time: string; durationMinutes: number; description: string }) => {
      if (!editingNode || !itinerary) return

      const updatedNode: ItineraryNode = {
        ...editingNode,
        name: updates.name,
        time: updates.time,
        durationMinutes: updates.durationMinutes,
        endTime: calculateEndTime(updates.time, updates.durationMinutes),
        description: updates.description,
        isUserModified: true,
        userStatus: 'modified',
      }

      const updatedGraph = {
        ...itinerary.graph,
        nodes: { ...itinerary.graph.nodes, [updatedNode.id]: updatedNode },
      }

      updateMutation.mutate({ itineraryId: itinerary.id, tripId, graph: updatedGraph })
      setEditingNode(null)
    },
    [editingNode, itinerary, tripId, updateMutation]
  )

  // ─── Handler de añadir nodo ───────────────────────────────────────────────

  const handleAddNode = useCallback(
    (newNode: ItineraryNode) => {
      if (!itinerary) return

      const targetDay = itinerary.graph.days.find((d) => d.id === newNode.dayId)
      if (!targetDay) return

      const nodeWithOrder: ItineraryNode = {
        ...newNode,
        order: targetDay.nodeIds.length,
      }

      const updatedNodes = {
        ...itinerary.graph.nodes,
        [nodeWithOrder.id]: nodeWithOrder,
      }
      const updatedDays = itinerary.graph.days.map((day) =>
        day.id === newNode.dayId
          ? { ...day, nodeIds: [...day.nodeIds, nodeWithOrder.id] }
          : day
      )

      const lastNodeId = targetDay.nodeIds[targetDay.nodeIds.length - 1]
      const newEdge = lastNodeId
        ? {
            id: `edge-${lastNodeId}-${nodeWithOrder.id}`,
            fromNodeId: lastNodeId,
            toNodeId: nodeWithOrder.id,
            type: 'sequential' as const,
          }
        : null

      const updatedGraph = {
        ...itinerary.graph,
        nodes: updatedNodes,
        days: updatedDays,
        edges: newEdge ? [...itinerary.graph.edges, newEdge] : itinerary.graph.edges,
        meta: { ...itinerary.graph.meta, totalNodes: itinerary.graph.meta.totalNodes + 1 },
      }

      updateMutation.mutate({ itineraryId: itinerary.id, tripId, graph: updatedGraph })
      setShowAddModal(false)
    },
    [itinerary, tripId, updateMutation]
  )

  // ─── Handler de edición asistida por IA ──────────────────────────────────

  const handleAIEditSubmit = useCallback(
    (instruction: string) => {
      if (!aiEditingNode || !itinerary) return
      setAiEditError(null)
      editNodeMutation.mutate(
        { itineraryId: itinerary.id, nodeId: aiEditingNode.id, instruction },
        {
          onSuccess: () => {
            setAiEditingNode(null)
            setAiEditError(null)
          },
          onError: (err) => {
            setAiEditError(err instanceof Error ? err.message : 'Error al editar el nodo con IA')
          },
        }
      )
    },
    [aiEditingNode, itinerary, editNodeMutation]
  )

  // ─── Renderizado de cada nodo en DraggableFlatList ────────────────────────
  // TouchableOpacity de RNGH es obligatorio para el drag handle — Pressable de RN
  // compite con el GestureDetector interno de DraggableFlatList y bloquea el gesto.

  const renderDraggableNode = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ItineraryNode>) => {
      // Handle de drag reutilizable — TouchableOpacity de RNGH (no Pressable de RN)
      const dragHandleEl = (
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={150}
          disabled={isActive}
          accessibilityRole="button"
          accessibilityLabel="Mantén pulsado para reordenar"
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 6,
            backgroundColor: '#334155',
          }}
        >
          <Text style={{ fontSize: 16, color: '#94a3b8', letterSpacing: 1 }}>⠿</Text>
        </TouchableOpacity>
      )

      if (item.type === 'transport') {
        return (
          <ScaleDecorator activeScale={0.97}>
            <View
              className="mb-1 flex-row items-center gap-2"
              style={{ opacity: isActive ? 0.7 : 1 }}
            >
              {dragHandleEl}
              <View className="flex-1">
                <TransferBadge node={item as TransportNode} />
              </View>
            </View>
          </ScaleDecorator>
        )
      }

      return (
        <ScaleDecorator activeScale={0.97}>
          <View className="mb-3" style={{ opacity: isActive ? 0.85 : 1 }}>
            <ItineraryNodeCard
              node={item}
              mode="view"
              onEdit={() => setEditingNode(item)}
              onAIEdit={() => { setAiEditError(null); setAiEditingNode(item) }}
              dragHandle={dragHandleEl}
            />
          </View>
        </ScaleDecorator>
      )
    },
    []
  )

  // ─── Estados de la pantalla ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-3 text-sm text-slate-400">Cargando itinerario...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="mb-4 text-4xl">😕</Text>
        <Text className="mb-2 text-lg font-bold text-white">No pudimos cargar el itinerario</Text>
        <Pressable
          onPress={() => refetch()}
          className="rounded-xl bg-indigo-600 px-6 py-3 active:bg-indigo-700"
          accessibilityRole="button"
        >
          <Text className="font-semibold text-white">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  if (!itinerary) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="mb-4 text-6xl" accessibilityElementsHidden>🗺️</Text>
        <Text className="mb-2 text-xl font-bold text-white">Sin itinerario todavía</Text>
        <Text className="mb-8 text-center text-sm text-slate-400">
          Genera un itinerario con IA y confírmalo para empezar a editarlo aquí.
        </Text>
        <Pressable
          onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/generate` as never)}
          className="rounded-xl bg-indigo-600 px-6 py-3 active:bg-indigo-700"
          accessibilityRole="button"
        >
          <Text className="font-semibold text-white">✨ Generar itinerario</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4" accessibilityRole="button">
          <Text className="text-sm text-indigo-400">← Volver al viaje</Text>
        </Pressable>
      </View>
    )
  }

  const { graph } = itinerary
  const totalCost = Object.values(graph.nodes)
    .filter((n) => n.userStatus !== 'rejected' && !n.cost.isIncluded && n.cost.amount !== undefined)
    .reduce((sum, n) => sum + (n.cost.amount ?? 0), 0)
  const currency = graph.meta.currency ?? '€'

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center border-b border-slate-700 px-4 pb-4 pt-12">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
          className="mr-3 rounded-lg p-1 active:bg-slate-800"
        >
          <Text className="text-2xl text-slate-400">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xs text-slate-500">Tu itinerario</Text>
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {graph.days.length} {graph.days.length === 1 ? 'día' : 'días'} · {graph.meta.totalNodes} actividades
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {totalCost > 0 ? (
            <View className="rounded-lg bg-indigo-900/60 px-2.5 py-1">
              <Text className="text-xs font-semibold text-indigo-300">
                ~{currency} {Math.round(totalCost)}
              </Text>
            </View>
          ) : null}
          {/* Toggle Lista / Agenda / Mapa */}
          <View className="flex-row gap-0.5 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
            <View className="rounded-md bg-slate-700 px-2.5 py-1">
              <Text className="text-xs font-semibold text-white">Lista</Text>
            </View>
            <Pressable
              onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/calendar` as never)}
              accessibilityRole="button"
              accessibilityLabel="Ver vista agenda"
              className="rounded-md px-2.5 py-1 active:bg-slate-700"
            >
              <Text className="text-xs font-semibold text-slate-400">Agenda</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/map` as never)}
              accessibilityRole="button"
              accessibilityLabel="Ver mapa del itinerario"
              className="rounded-md px-2.5 py-1 active:bg-slate-700"
            >
              <Text className="text-xs font-semibold text-slate-400">🗺️</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setIsEditMode((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={isEditMode ? 'Salir del modo edición' : 'Editar orden del itinerario'}
            className={`rounded-lg px-3 py-1.5 ${
              isEditMode ? 'bg-indigo-600' : 'bg-slate-700 active:bg-slate-600'
            }`}
          >
            <Text className="text-xs font-semibold text-white">
              {isEditMode ? 'Listo' : '↕ Orden'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs de días */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-slate-700"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {graph.days.map((day, idx) => (
          <Pressable
            key={day.id}
            onPress={() => setSelectedDayIndex(idx)}
            accessibilityRole="tab"
            accessibilityState={{ selected: idx === selectedDayIndex }}
            className={`rounded-xl border px-4 py-2 ${
              idx === selectedDayIndex
                ? 'border-indigo-500 bg-indigo-950'
                : 'border-slate-700 bg-slate-800'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                idx === selectedDayIndex ? 'text-indigo-300' : 'text-slate-400'
              }`}
            >
              {day.title ?? `Día ${day.dayNumber}`}
            </Text>
            <Text
              className={`text-xs ${
                idx === selectedDayIndex ? 'text-indigo-400/70' : 'text-slate-600'
              }`}
            >
              {day.nodeIds.length} actos.
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Hint en modo edición */}
      {isEditMode ? (
        <View className="border-b border-amber-500/20 bg-amber-950/20 px-4 py-2">
          <Text className="text-center text-xs text-amber-400/80">
            Mantén pulsado ⠿⠿ para arrastrar y reordenar
          </Text>
        </View>
      ) : null}

      {/* Contenido del día */}
      {isEditMode ? (
        // Modo edición: DraggableFlatList para reordenar
        <DraggableFlatList
          data={dayNodes}
          onDragEnd={handleDragEnd}
          keyExtractor={(item) => item.id}
          renderItem={renderDraggableNode}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          ListHeaderComponent={
            selectedDay ? <DayRouteCard nodes={dayNodes} /> : null
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-slate-500">Sin actividades en este día</Text>
            </View>
          }
        />
      ) : (
        // Modo vista: ScrollView estático
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          {selectedDay ? <DayRouteCard nodes={dayNodes} /> : null}

          {dayNodes.length === 0 ? (
            <View className="items-center py-12">
              <Text className="mb-2 text-slate-500">Sin actividades en este día</Text>
              <Text className="text-xs text-slate-600">
                Usa el botón + para añadir una actividad
              </Text>
            </View>
          ) : null}

          {dayNodes.map((node) => {
            if (node.type === 'transport') {
              return (
                <View key={node.id} className="mb-1">
                  <TransferBadge node={node as TransportNode} />
                </View>
              )
            }
            return (
              <View key={node.id} className="mb-3">
                <ItineraryNodeCard
                  node={node}
                  mode="view"
                  onEdit={() => setEditingNode(node)}
                  onAIEdit={() => { setAiEditError(null); setAiEditingNode(node) }}
                />
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* FAB — añadir nodo */}
      <Pressable
        onPress={() => setShowAddModal(true)}
        accessibilityRole="button"
        accessibilityLabel="Añadir actividad al itinerario"
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg active:bg-indigo-700"
        style={{ elevation: 6 }}
      >
        <Text className="text-2xl font-light text-white">+</Text>
      </Pressable>

      {/* Modal de edición manual — key fuerza remount al abrir un nodo distinto */}
      {editingNode ? (
        <EditNodeModal
          key={editingNode.id}
          node={editingNode}
          isSaving={updateMutation.isPending}
          onClose={() => setEditingNode(null)}
          onSave={handleSaveEdit}
        />
      ) : null}

      {/* Modal para añadir nodo */}
      <AddNodeModal
        visible={showAddModal}
        days={itinerary.graph.days}
        currentDayId={selectedDay?.id ?? itinerary.graph.days[0]?.id ?? ''}
        isSaving={updateMutation.isPending}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddNode}
      />

      {/* Modal de edición asistida por IA */}
      <AIEditModal
        node={aiEditingNode}
        isLoading={editNodeMutation.isPending}
        error={aiEditError}
        onClose={() => { setAiEditingNode(null); setAiEditError(null) }}
        onSubmit={handleAIEditSubmit}
      />
    </View>
  )
}
