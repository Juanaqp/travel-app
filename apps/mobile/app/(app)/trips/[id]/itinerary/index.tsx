import { useState, useCallback } from 'react'
import {
  View,
  Text as RNText,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist'
import { useItinerary } from '@/hooks/useItinerary'
import { useUpdateItinerary } from '@/hooks/useUpdateItinerary'
import { useEditNode } from '@/hooks/useEditNode'
import { ItineraryNodeCard, TransferBadge } from '@/components/ItineraryNodeCard'
import { DayRouteCard } from '@/components/DayRouteCard'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
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

// ─── Modal de edición manual ──────────────────────────────────────────────────

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
            <RNText className="mb-4 text-lg font-bold text-white">Editar actividad</RNText>

            <RNText className="mb-1 text-xs font-semibold text-slate-400">Nombre</RNText>
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
                <RNText className="mb-1 text-xs font-semibold text-slate-400">Hora (HH:MM)</RNText>
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
                <RNText className="mb-1 text-xs font-semibold text-slate-400">Duración (min)</RNText>
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

            <RNText className="mb-1 text-xs font-semibold text-slate-400">Descripción</RNText>
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
                <RNText className="font-semibold text-white">Cancelar</RNText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className="flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RNText className="font-semibold text-white">Guardar</RNText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Modal para añadir nodo ───────────────────────────────────────────────────

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
            <RNText className="mb-4 text-lg font-bold text-white">Añadir actividad</RNText>

            {days.length > 1 ? (
              <View className="mb-4">
                <RNText className="mb-2 text-xs font-semibold text-slate-400">Día</RNText>
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
                        <RNText
                          className={`text-xs font-semibold ${
                            selectedDayId === day.id ? 'text-indigo-300' : 'text-slate-300'
                          }`}
                        >
                          {day.title ?? `Día ${day.dayNumber}`}
                        </RNText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <RNText className="mb-2 text-xs font-semibold text-slate-400">Tipo</RNText>
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
                  <RNText
                    className={`text-xs font-semibold ${
                      selectedType === opt.type ? 'text-indigo-300' : 'text-slate-300'
                    }`}
                  >
                    {DEFAULT_NODE_EMOJI[opt.type]} {opt.label}
                  </RNText>
                </Pressable>
              ))}
            </View>

            <RNText className="mb-1 text-xs font-semibold text-slate-400">Nombre *</RNText>
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
                <RNText className="mb-1 text-xs font-semibold text-slate-400">Hora * (HH:MM)</RNText>
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
                <RNText className="mb-1 text-xs font-semibold text-slate-400">Duración (min)</RNText>
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
                <RNText className="font-semibold text-white">Cancelar</RNText>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                disabled={isSaving || !name.trim()}
                className="flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RNText className="font-semibold text-white">Añadir</RNText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Modal de edición asistida por IA ────────────────────────────────────────

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
              <RNText className="text-lg font-bold text-white">✨ Editar con IA</RNText>
            </View>

            <View className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <RNText className="text-xs text-slate-500">Nodo a modificar</RNText>
              <RNText className="mt-0.5 font-semibold text-white">
                {node.emoji} {node.name}
              </RNText>
              <RNText className="text-xs text-slate-500">
                {node.time} · {node.durationMinutes} min
              </RNText>
            </View>

            <RNText className="mb-2 text-xs font-semibold text-slate-400">
              ¿Qué quieres cambiar? *
            </RNText>
            <View className="mb-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <TextInput
                value={instruction}
                onChangeText={setInstruction}
                placeholder="Ej: cámbialo por algo más barato, añade el horario real..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                maxLength={500}
                editable={!isLoading}
                style={{ color: '#f1f5f9', fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>
            <RNText className="mb-4 text-right text-xs text-slate-600">
              {instruction.length}/500
            </RNText>

            {error ? (
              <View className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2">
                <RNText className="text-xs text-red-400">{error}</RNText>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                disabled={isLoading}
                className="flex-1 items-center rounded-xl bg-slate-700 py-3 active:bg-slate-600 disabled:opacity-50"
              >
                <RNText className="font-semibold text-white">Cancelar</RNText>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading || instruction.trim().length < 5}
                className="flex-2 flex-1 items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#fff" />
                    <RNText className="font-semibold text-white">Procesando...</RNText>
                  </View>
                ) : (
                  <RNText className="font-semibold text-white">✨ Aplicar cambio</RNText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatShortDate = (dateStr: string): string => {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = dateStr.split('-')
  const day = parseInt(parts[2] ?? '1', 10)
  const month = parseInt(parts[1] ?? '1', 10)
  return `${day} ${MONTHS[month - 1] ?? ''}`
}

const buildDurationLabel = (nodes: ItineraryNode[]): string => {
  const total = nodes.reduce((sum, n) => sum + n.durationMinutes, 0)
  if (total === 0) return ''
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const tripId = id ?? ''
  const insets = useSafeAreaInsets()

  const { data: itinerary, isLoading, error, refetch } = useItinerary(tripId)
  const updateMutation = useUpdateItinerary(tripId)
  const editNodeMutation = useEditNode(tripId)
  const { colors, isDark } = useTheme()

  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [editingNode, setEditingNode] = useState<ItineraryNode | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [aiEditingNode, setAiEditingNode] = useState<ItineraryNode | null>(null)
  const [aiEditError, setAiEditError] = useState<string | null>(null)

  const selectedDay = itinerary?.graph.days[selectedDayIndex]
  const dayNodes: ItineraryNode[] = selectedDay
    ? selectedDay.nodeIds
        .map((nodeId) => itinerary?.graph.nodes[nodeId])
        .filter((node): node is ItineraryNode => !!node && node.userStatus !== 'rejected')
    : []

  // ─── Handler de reorden ───────────────────────────────────────────────────

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

      const nodeWithOrder: ItineraryNode = { ...newNode, order: targetDay.nodeIds.length }
      const updatedNodes = { ...itinerary.graph.nodes, [nodeWithOrder.id]: nodeWithOrder }
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

  // ─── Handler de edición con IA ────────────────────────────────────────────

  const handleAIEditSubmit = useCallback(
    (instruction: string) => {
      if (!aiEditingNode || !itinerary) return
      setAiEditError(null)
      editNodeMutation.mutate(
        { itineraryId: itinerary.id, nodeId: aiEditingNode.id, instruction },
        {
          onSuccess: () => { setAiEditingNode(null); setAiEditError(null) },
          onError: (err) => {
            setAiEditError(err instanceof Error ? err.message : 'Error al editar el nodo con IA')
          },
        }
      )
    },
    [aiEditingNode, itinerary, editNodeMutation]
  )

  // ─── Render de nodo draggable ─────────────────────────────────────────────
  // TouchableOpacity de RNGH es obligatorio — Pressable de RN compite con GestureDetector

  const renderDraggableNode = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ItineraryNode>) => {
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
            backgroundColor: colors.background.elevated ?? colors.background.surface,
          }}
        >
          <RNText style={{ fontSize: 16, color: colors.text.tertiary, letterSpacing: 1 }}>⠿</RNText>
        </TouchableOpacity>
      )

      if (item.type === 'transport') {
        return (
          <ScaleDecorator activeScale={0.97}>
            <View style={[styles.draggableTransportRow, { opacity: isActive ? 0.7 : 1 }]}>
              {dragHandleEl}
              <View style={{ flex: 1 }}>
                <TransferBadge node={item as TransportNode} />
              </View>
            </View>
          </ScaleDecorator>
        )
      }

      return (
        <ScaleDecorator activeScale={0.97}>
          <View style={[styles.draggableNodeWrapper, { opacity: isActive ? 0.85 : 1 }]}>
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
    [colors]
  )

  // ─── Estados de la pantalla ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background.base }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color={colors.text.tertiary} style={styles.loadingLabel}>
          Cargando itinerario...
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background.base }]}>
        <Icon name="offline" size="xl" color={colors.text.tertiary} />
        <Text variant="subheading" weight="semibold" color={colors.text.secondary} align="center" style={styles.loadingLabel}>
          No pudimos cargar el itinerario
        </Text>
        <Pressable
          onPress={() => { refetch().catch(() => {}) }}
          accessibilityRole="button"
          style={[styles.retryBtn, { borderColor: colors.primary }]}
        >
          <Text variant="label" weight="semibold" color={colors.primary}>Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  if (!itinerary) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background.base }]}>
        <View style={[styles.emptyIconWrapper, { backgroundColor: `${colors.primary}18` }]}>
          <Icon name="calendar" size="xl" color={colors.primary} />
        </View>
        <Text variant="heading" weight="bold" color={colors.text.primary} align="center">
          Sin itinerario todavía
        </Text>
        <Text variant="body" color={colors.text.secondary} align="center" style={styles.emptySubtitle}>
          Genera un itinerario con IA y confírmalo para empezar a editarlo aquí.
        </Text>
        <Pressable
          onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/generate` as never)}
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text variant="label" weight="semibold" color="#FFFFFF">✨ Generar itinerario</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={styles.backLink}
        >
          <Text variant="label" color={colors.primary}>← Volver al viaje</Text>
        </Pressable>
      </View>
    )
  }

  const { graph } = itinerary
  const totalCost = Object.values(graph.nodes)
    .filter((n) => n.userStatus !== 'rejected' && !n.cost.isIncluded && n.cost.amount !== undefined)
    .reduce((sum, n) => sum + (n.cost.amount ?? 0), 0)
  const currency = graph.meta.currency ?? '€'
  const durationLabel = buildDurationLabel(dayNodes)

  return (
    <View style={[styles.root, { backgroundColor: colors.background.base }]}>

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            backgroundColor: colors.background.base,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
          style={styles.backBtn}
        >
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text variant="caption" color={colors.text.tertiary}>
            Tu itinerario
          </Text>
          <Text variant="label" weight="semibold" color={colors.text.primary} numberOfLines={1}>
            {graph.days.length} {graph.days.length === 1 ? 'día' : 'días'} · {graph.meta.totalNodes} actividades
          </Text>
        </View>

        <View style={styles.headerRight}>
          {totalCost > 0 ? (
            <View style={[styles.costBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text variant="caption" weight="semibold" color={colors.primary}>
                ~{currency} {Math.round(totalCost)}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/calendar` as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver vista agenda"
            style={[styles.headerIcon, { backgroundColor: colors.background.surface }]}
          >
            <Icon name="calendar" size="md" color={colors.text.secondary} />
          </Pressable>

          <Pressable
            onPress={() => router.push(`/(app)/trips/${tripId}/itinerary/map` as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver mapa del itinerario"
            style={[styles.headerIcon, { backgroundColor: colors.background.surface }]}
          >
            <Icon name="map" size="md" color={colors.text.secondary} />
          </Pressable>

          {!isEditMode ? (
            <Pressable
              onPress={() => setIsEditMode(true)}
              accessibilityRole="button"
              accessibilityLabel="Editar orden del itinerario"
              style={[styles.editToggle, { backgroundColor: colors.background.surface, borderColor: colors.border }]}
            >
              <Text variant="caption" weight="semibold" color={colors.text.secondary}>
                Ordenar
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Pills de días */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.dayPillsRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.dayPillsContent}
      >
        {graph.days.map((day, idx) => {
          const isActive = idx === selectedDayIndex
          return (
            <Pressable
              key={day.id}
              onPress={() => setSelectedDayIndex(idx)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.dayPill,
                {
                  backgroundColor: isActive ? colors.primary : colors.background.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text variant="label" weight="semibold" color={isActive ? '#FFFFFF' : colors.text.primary}>
                {day.title ?? `Día ${day.dayNumber}`}
              </Text>
              <Text variant="caption" color={isActive ? 'rgba(255,255,255,0.75)' : colors.text.tertiary}>
                {day.nodeIds.length} act.
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Encabezado del día con fecha + duración */}
      {selectedDay ? (
        <View style={[styles.dayHeader, { backgroundColor: colors.background.base, borderBottomColor: colors.border }]}>
          <Text variant="label" weight="semibold" color={colors.text.primary}>
            {selectedDay.date ? formatShortDate(selectedDay.date) : (selectedDay.title ?? `Día ${selectedDay.dayNumber}`)}
          </Text>
          {durationLabel ? (
            <Text variant="caption" color={colors.text.tertiary}>
              {durationLabel}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Hint de modo edición */}
      {isEditMode ? (
        <View style={[styles.editHint, { backgroundColor: `${colors.semantic.warning}12`, borderBottomColor: `${colors.semantic.warning}25` }]}>
          <Text variant="caption" color={colors.semantic.warning} align="center">
            Mantén pulsado ⠿ para arrastrar y reordenar
          </Text>
        </View>
      ) : null}

      {/* Contenido del día */}
      {isEditMode ? (
        <DraggableFlatList
          data={dayNodes}
          onDragEnd={handleDragEnd}
          keyExtractor={(item) => item.id}
          renderItem={renderDraggableNode}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={selectedDay ? <DayRouteCard nodes={dayNodes} /> : null}
          ListEmptyComponent={<EmptyDayState onAdd={() => setShowAddModal(true)} colors={colors} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedDay ? <DayRouteCard nodes={dayNodes} /> : null}

          {dayNodes.length === 0 ? (
            <EmptyDayState onAdd={() => setShowAddModal(true)} colors={colors} />
          ) : null}

          {dayNodes.map((node) => {
            if (node.type === 'transport') {
              return (
                <View key={node.id} style={styles.transferWrapper}>
                  <TransferBadge node={node as TransportNode} />
                </View>
              )
            }
            return (
              <View key={node.id} style={styles.nodeWrapper}>
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

      {/* FAB añadir — visible solo en modo vista */}
      {!isEditMode ? (
        <Pressable
          onPress={() => setShowAddModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Añadir actividad al itinerario"
          style={[styles.addFab, { backgroundColor: colors.primary }]}
        >
          <Icon name="add" size="lg" color="#FFFFFF" />
        </Pressable>
      ) : null}

      {/* FAB Listo — visible solo en modo edición */}
      {isEditMode ? (
        <Pressable
          onPress={() => setIsEditMode(false)}
          accessibilityRole="button"
          accessibilityLabel="Terminar edición de orden"
          style={[styles.doneFab, { backgroundColor: colors.primary }]}
        >
          <Text variant="label" weight="semibold" color="#FFFFFF">
            Listo
          </Text>
        </Pressable>
      ) : null}

      {/* Modales */}
      {editingNode ? (
        <EditNodeModal
          key={editingNode.id}
          node={editingNode}
          isSaving={updateMutation.isPending}
          onClose={() => setEditingNode(null)}
          onSave={handleSaveEdit}
        />
      ) : null}

      <AddNodeModal
        visible={showAddModal}
        days={itinerary.graph.days}
        currentDayId={selectedDay?.id ?? itinerary.graph.days[0]?.id ?? ''}
        isSaving={updateMutation.isPending}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddNode}
      />

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

// ─── Estado vacío del día (tarjeta punteada) ──────────────────────────────────

interface EmptyDayStateProps {
  onAdd: () => void
  colors: ReturnType<typeof useTheme>['colors']
}

const EmptyDayState = ({ onAdd, colors }: EmptyDayStateProps) => (
  <Pressable
    onPress={onAdd}
    accessibilityRole="button"
    accessibilityLabel="Añadir primera actividad al día"
    style={[
      styles.emptyDayCard,
      { borderColor: colors.border },
    ]}
  >
    <View style={[styles.emptyDayIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
      <Icon name="add" size="lg" color={colors.primary} />
    </View>
    <Text variant="label" weight="semibold" color={colors.text.secondary} align="center">
      Sin actividades en este día
    </Text>
    <Text variant="caption" color={colors.text.tertiary} align="center">
      Toca para añadir la primera
    </Text>
  </Pressable>
)

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  loadingLabel: {
    marginTop: theme.spacing.sm,
  },
  retryBtn: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    marginBottom: theme.spacing.lg,
  },
  primaryBtn: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
  },
  backLink: {
    marginTop: theme.spacing.md,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  costBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editToggle: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  // Day pills
  dayPillsRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayPillsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  dayPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 72,
  },
  // Day header row
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editHint: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Content
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  nodeWrapper: {
    marginBottom: theme.spacing.sm,
  },
  transferWrapper: {
    marginBottom: theme.spacing.xs,
  },
  draggableNodeWrapper: {
    marginBottom: theme.spacing.sm,
  },
  draggableTransportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  // FABs
  addFab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  doneFab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -48 }],
    width: 96,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  // Empty day card
  emptyDayCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  emptyDayIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
})
