// Registro centralizado de iconos Ionicons
// Usar siempre estas claves en lugar de strings directos para evitar typos
// y facilitar cambios globales de iconos sin tocar cada componente

/** Par filled/outline para cada icono del sistema */
interface IconEntry {
  readonly filled: string
  readonly outline: string
}

export const icons = {
  // ─── Navegación (tabs) ────────────────────────────────────────────────────
  explore:      { filled: 'compass',           outline: 'compass-outline' },
  trips:        { filled: 'map',               outline: 'map-outline' },
  documents:    { filled: 'folder',            outline: 'folder-outline' },
  profile:      { filled: 'person-circle',     outline: 'person-circle-outline' },

  // ─── Acciones generales ───────────────────────────────────────────────────
  add:          { filled: 'add-circle',        outline: 'add-circle-outline' },
  edit:         { filled: 'create',            outline: 'create-outline' },
  delete:       { filled: 'trash',             outline: 'trash-outline' },
  save:         { filled: 'bookmark',          outline: 'bookmark-outline' },
  share:        { filled: 'share-social-outline', outline: 'share-social-outline' },
  close:        { filled: 'close',             outline: 'close' },
  back:         { filled: 'chevron-back',      outline: 'chevron-back' },
  forward:      { filled: 'chevron-forward',   outline: 'chevron-forward' },
  menu:         { filled: 'ellipsis-horizontal', outline: 'ellipsis-horizontal' },
  search:       { filled: 'search-outline',    outline: 'search-outline' },
  filter:       { filled: 'options-outline',   outline: 'options-outline' },

  // ─── Viajes y categorías ──────────────────────────────────────────────────
  flight:       { filled: 'airplane-outline',  outline: 'airplane-outline' },
  hotel:        { filled: 'bed-outline',       outline: 'bed-outline' },
  restaurant:   { filled: 'restaurant-outline', outline: 'restaurant-outline' },
  activity:     { filled: 'camera-outline',    outline: 'camera-outline' },
  transport:    { filled: 'car-outline',       outline: 'car-outline' },
  attraction:   { filled: 'location-outline',  outline: 'location-outline' },
  budget:       { filled: 'wallet-outline',    outline: 'wallet-outline' },
  calendar:     { filled: 'calendar-outline',  outline: 'calendar-outline' },
  map:          { filled: 'map-outline',       outline: 'map-outline' },
  weather:      { filled: 'partly-sunny-outline', outline: 'partly-sunny-outline' },
  passport:     { filled: 'id-card-outline',   outline: 'id-card-outline' },
  visa:         { filled: 'document-text-outline', outline: 'document-text-outline' },
  checkin:      { filled: 'checkmark-circle',  outline: 'checkmark-circle-outline' },

  // ─── Estado del sistema ───────────────────────────────────────────────────
  notification: { filled: 'notifications',     outline: 'notifications-outline' },
  offline:      { filled: 'cloud-offline-outline', outline: 'cloud-offline-outline' },
  sync:         { filled: 'sync-outline',      outline: 'sync-outline' },
  ai:           { filled: 'sparkles-outline',  outline: 'sparkles-outline' },
  settings:     { filled: 'settings-outline',  outline: 'settings-outline' },
  logout:       { filled: 'log-out-outline',   outline: 'log-out-outline' },
  theme:        { filled: 'contrast-outline',  outline: 'contrast-outline' },
} as const satisfies Record<string, IconEntry>

/** Claves válidas del registro de iconos */
export type IconName = keyof typeof icons

/** Tamaños estándar de icono en píxeles */
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const

export type IconSizeName = keyof typeof iconSize
