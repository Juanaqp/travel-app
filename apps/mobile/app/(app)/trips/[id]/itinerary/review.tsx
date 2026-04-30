import { useState } from 'react'
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useItineraryStore } from '@/stores/useItineraryStore'
import { useApproveItinerary } from '@/hooks/useApproveItinerary'
import { editNode } from '@/hooks/useEditNode'
import { ItineraryNodeCard, TransferBadge } from '@/components/ItineraryNodeCard'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { logger } from '@/lib/logger'
import type { ItineraryNode, TransportNode } from '@travelapp/types'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface EditNodeForm {
  name: string
  time: string
  durationMinutes: string
}

const EMPTY_EDIT_FORM: EditNodeForm = { name: '', time: '', durationMinutes: '' }

// ─── Modal de edición manual ──────────────────────────────────────────────────

interface EditNodeModalProps {
  node: ItineraryNode | null
  form: EditNodeForm
  onChange: (field: keyof EditNodeForm, value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

const EditNodeModal = ({ node, form, onChange, onConfirm, onCancel }: EditNodeModalProps) => {
  const { colors } = useTheme()
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
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.background.surface, borderTopColor: colors.border },
          ]}
        >
          {/* Handle */}
          <View style={styles.modalHandle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          <Text variant="subheading" weight="bold" color={colors.text.primary} style={styles.modalTitle}>
            Editar actividad
          </Text>

          <Text variant="caption" weight="semibold" color={colors.text.secondary} style={styles.fieldLabel}>
            Nombre
          </Text>
          <View style={[styles.fieldWrapper, { borderColor: colors.border, backgroundColor: colors.background.base }]}>
            <TextInput
              value={form.name}
              onChangeText={(v) => onChange('name', v)}
              placeholder={node.name}
              placeholderTextColor={colors.text.tertiary}
              maxLength={200}
              style={[styles.fieldInput, { color: colors.text.primary }]}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" weight="semibold" color={colors.text.secondary} style={styles.fieldLabel}>
                Hora (HH:mm)
              </Text>
              <View style={[styles.fieldWrapper, { borderColor: colors.border, backgroundColor: colors.background.base }]}>
                <TextInput
                  value={form.time}
                  onChangeText={(v) => onChange('time', v)}
                  placeholder={node.time}
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.fieldInput, { color: colors.text.primary }]}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" weight="semibold" color={colors.text.secondary} style={styles.fieldLabel}>
                Duración (min)
              </Text>
              <View style={[styles.fieldWrapper, { borderColor: colors.border, backgroundColor: colors.background.base }]}>
                <TextInput
                  value={form.durationMinutes}
                  onChangeText={(v) => onChange('durationMinutes', v)}
                  placeholder={String(node.durationMinutes)}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[styles.fieldInput, { color: colors.text.primary }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button label="Confirmar cambios" onPress={onConfirm} variant="primary" />
            <Button label="Cancelar" onPress={onCancel} variant="ghost" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Modal de edición con IA ──────────────────────────────────────────────────

interface AIEditModalProps {
  node: ItineraryNode | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  onSubmit: (instruction: string) => void
}

const AIEditModal = ({ node, isLoading, error, onClose, onSubmit }: AIEditModalProps) => {
  const [instruction, setInstruction] = useState('')
  const { colors } = useTheme()

  if (!node) return null

  const handleSubmit = () => {
    if (instruction.trim().length < 5) return
    onSubmit(instruction.trim())
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.aiModalBackdrop}
        onPress={onClose}
        accessibilityLabel="Cerrar modal"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            onPress={() => {}}
            style={[styles.aiModalSheet, { backgroundColor: colors.background.surface }]}
          >
            <Text variant="subheading" weight="bold" color={colors.text.primary} style={styles.modalTitle}>
              ✨ Editar con IA
            </Text>

            <View style={[styles.aiNodeSummary, { backgroundColor: colors.background.base, borderColor: colors.border }]}>
              <Text variant="caption" color={colors.text.tertiary}>Nodo a modificar</Text>
              <Text variant="label" weight="semibold" color={colors.text.primary}>
                {node.emoji} {node.name}
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                {node.time} · {node.durationMinutes} min
              </Text>
            </View>

            <Text variant="caption" weight="semibold" color={colors.text.secondary} style={styles.fieldLabel}>
              ¿Qué quieres cambiar? *
            </Text>
            <View style={[styles.fieldWrapper, { borderColor: colors.border, backgroundColor: colors.background.base }]}>
              <TextInput
                value={instruction}
                onChangeText={setInstruction}
                placeholder="Ej: cámbialo por algo más barato, añade el horario real..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={3}
                maxLength={500}
                editable={!isLoading}
                style={[styles.textArea, { color: colors.text.primary }]}
              />
            </View>
            <Text variant="caption" color={colors.text.tertiary} style={styles.charCount}>
              {instruction.length}/500
            </Text>

            {error ? (
              <View style={[styles.errorCard, { backgroundColor: `${colors.semantic.danger}10`, borderColor: `${colors.semantic.danger}30` }]}>
                <Text variant="caption" color={colors.semantic.danger}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.aiModalActions}>
              <Pressable
                onPress={onClose}
                disabled={isLoading}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text variant="label" weight="semibold" color={colors.text.secondary}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading || instruction.trim().length < 5}
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (isLoading || instruction.trim().length < 5) ? 0.5 : 1 }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text variant="label" weight="semibold" color="#FFFFFF">✨ Aplicar cambio</Text>
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
  const insets = useSafeAreaInsets()
  const draftGraph = useItineraryStore((s) => s.draftGraph)
  const updateNode = useItineraryStore((s) => s.updateNode)
  const { mutateAsync: approve, isPending: isApproving, error: approveError } = useApproveItinerary()
  const { colors } = useTheme()

  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditNodeForm>(EMPTY_EDIT_FORM)
  const [aiEditingNode, setAiEditingNode] = useState<ItineraryNode | null>(null)
  const [aiEditError, setAiEditError] = useState<string | null>(null)
  const [isAiEditing, setIsAiEditing] = useState(false)

  if (!draftGraph) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background.base }]}>
        <Icon name="calendar" size="xl" color={colors.text.tertiary} />
        <Text variant="subheading" weight="semibold" color={colors.text.secondary} align="center">
          No hay itinerario para revisar
        </Text>
        <Text variant="body" color={colors.text.tertiary} align="center">
          Genera un itinerario primero para poder revisarlo.
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text variant="label" color={colors.primary}>← Volver a generar</Text>
        </Pressable>
      </View>
    )
  }

  const activeDay = draftGraph.days[activeDayIndex]
  if (!activeDay) return null

  const activeNodes = activeDay.nodeIds
    .map((nodeId) => draftGraph.nodes[nodeId])
    .filter((n): n is ItineraryNode => n !== undefined)

  const edgeByPair = new Map(
    draftGraph.edges.map((e) => [`${e.fromNodeId}→${e.toNodeId}`, e])
  )

  const totalCost = Object.values(draftGraph.nodes)
    .filter((n) => n.userStatus !== 'rejected')
    .reduce((sum, n) => sum + (n.cost.amount ?? 0), 0)

  const currency = draftGraph.meta.currency ?? 'EUR'

  // Progreso de revisión
  const allReviewable = Object.values(draftGraph.nodes).filter((n) => n.type !== 'transport')
  const reviewed = allReviewable.filter((n) => n.userStatus !== 'pending').length
  const progressRatio = allReviewable.length > 0 ? reviewed / allReviewable.length : 0

  const editingNode = editingNodeId ? draftGraph.nodes[editingNodeId] ?? null : null

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleApproveNode = (nodeId: string) => {
    updateNode(nodeId, (n) => ({ ...n, userStatus: 'approved' as const }))
  }

  const handleRejectNode = (nodeId: string) => {
    updateNode(nodeId, (n) => ({ ...n, userStatus: 'rejected' as const }))
  }

  const handleOpenEdit = (node: ItineraryNode) => {
    setEditForm({ name: node.name, time: node.time, durationMinutes: String(node.durationMinutes) })
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
        durationMinutes: !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : node.durationMinutes,
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
      const updatedNode = await editNode({ nodeId: aiEditingNode.id, instruction, nodeData: aiEditingNode })
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
      logger.error('Error al aprobar itinerario desde la pantalla de revisión', { err })
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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
          accessibilityLabel="Volver"
          style={styles.backBtn}
        >
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.text.tertiary}>Revisión del itinerario</Text>
          <Text variant="label" weight="semibold" color={colors.text.primary} numberOfLines={1}>
            {draftGraph.userPrompt.slice(0, 60)}
          </Text>
        </View>
        <Text variant="caption" color={colors.text.tertiary}>
          {reviewed}/{allReviewable.length}
        </Text>
      </View>

      {/* Barra de progreso 3px */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressRatio * 100}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>

      {/* Tabs de días */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.dayTabsRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.dayTabsContent}
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
              style={[
                styles.dayTab,
                {
                  backgroundColor: isActive ? colors.primary : colors.background.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text variant="label" weight="semibold" color={isActive ? '#FFFFFF' : colors.text.primary}>
                Día {day.dayNumber}
              </Text>
              {day.destinationCity ? (
                <Text
                  variant="caption"
                  color={isActive ? 'rgba(255,255,255,0.75)' : colors.text.tertiary}
                  numberOfLines={1}
                >
                  {day.destinationCity}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Lista de nodos */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {activeDay.title ? (
          <Text
            variant="caption"
            weight="semibold"
            color={colors.text.tertiary}
            style={styles.dayTitle}
          >
            {activeDay.title}
          </Text>
        ) : null}

        {activeNodes.length === 0 ? (
          <View style={styles.emptyDay}>
            <Icon name="calendar" size="xl" color={colors.text.tertiary} />
            <Text variant="body" color={colors.text.tertiary}>No hay actividades para este día</Text>
          </View>
        ) : null}

        {activeNodes.map((node, idx) => {
          const prevNode = idx > 0 ? activeNodes[idx - 1] : null
          const edgeFromPrev = prevNode ? edgeByPair.get(`${prevNode.id}→${node.id}`) : undefined

          if (node.type === 'transport') {
            return <TransferBadge key={node.id} node={node as TransportNode} />
          }

          return (
            <View key={node.id}>
              {edgeFromPrev && edgeFromPrev.durationMinutes && edgeFromPrev.type !== 'transport' ? (
                <View style={styles.transitRow}>
                  <View style={[styles.transitLine, { backgroundColor: colors.border }]} />
                  <Text variant="caption" color={colors.text.tertiary} style={styles.transitText}>
                    {edgeFromPrev.durationMinutes} min →
                  </Text>
                  <View style={[styles.transitLine, { backgroundColor: colors.border }]} />
                </View>
              ) : (
                <View style={styles.nodeGap} />
              )}

              <ItineraryNodeCard
                node={node}
                mode="review"
                onApprove={() => handleApproveNode(node.id)}
                onReject={() => handleRejectNode(node.id)}
                onEdit={() => handleOpenEdit(node)}
                onAIEdit={() => { setAiEditError(null); setAiEditingNode(node) }}
              />
            </View>
          )
        })}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Barra inferior */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background.base,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + theme.spacing.md,
          },
        ]}
      >
        {approveError ? (
          <Text
            variant="caption"
            color={colors.semantic.danger}
            align="center"
            style={styles.approveError}
          >
            ❌ {(approveError as Error).message ?? 'Error al guardar el itinerario'}
          </Text>
        ) : null}

        {totalCost > 0 ? (
          <Text variant="caption" color={colors.text.secondary} align="center" style={styles.costLabel}>
            Costo estimado:{' '}
            <Text variant="caption" weight="semibold" color={colors.text.primary}>
              {currency} {Math.round(totalCost)}
            </Text>
          </Text>
        ) : null}

        <View style={styles.bottomActions}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={[styles.regenerateBtn, { borderColor: colors.border, backgroundColor: colors.background.surface }]}
          >
            <Text variant="label" weight="semibold" color={colors.text.secondary}>🔄 Regenerar</Text>
          </Pressable>

          <Pressable
            onPress={handleApproveItinerary}
            disabled={isApproving}
            accessibilityRole="button"
            accessibilityLabel="Aprobar y guardar itinerario"
            style={[
              styles.approveBtn,
              { backgroundColor: colors.primary, opacity: isApproving ? 0.5 : 1 },
            ]}
          >
            <Text variant="label" weight="semibold" color="#FFFFFF">
              {isApproving ? 'Guardando...' : '✓ Aprobar itinerario'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Modales */}
      {editingNode ? (
        <EditNodeModal
          node={editingNode}
          form={editForm}
          onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
          onConfirm={handleConfirmEdit}
          onCancel={() => { setEditingNodeId(null); setEditForm(EMPTY_EDIT_FORM) }}
        />
      ) : null}

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

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
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
  progressTrack: {
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
  dayTabsRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayTabsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  dayTab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 72,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  dayTitle: {
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  transitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  transitLine: {
    flex: 1,
    height: 1,
  },
  transitText: {
    marginHorizontal: theme.spacing.sm,
  },
  nodeGap: { height: theme.spacing.sm },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  approveError: {
    marginBottom: theme.spacing.xs,
  },
  costLabel: {
    marginBottom: theme.spacing.xs,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  regenerateBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    flex: 2,
    height: 48,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  modalHandle: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
  },
  modalTitle: {
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    marginBottom: theme.spacing.xs,
  },
  fieldWrapper: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  fieldInput: {
    fontSize: theme.typography.size.base,
    height: 40,
  },
  modalActions: {
    gap: theme.spacing.sm,
  },
  // AI modal
  aiModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  aiModalSheet: {
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  aiNodeSummary: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    gap: 2,
  },
  textArea: {
    fontSize: theme.typography.size.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    marginBottom: theme.spacing.sm,
  },
  errorCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  aiModalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 2,
    height: 48,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
