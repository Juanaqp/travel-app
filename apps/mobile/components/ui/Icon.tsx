// Componente icono — renderiza Ionicons desde el registro centralizado de icons.ts
// Resuelve filled/outline automáticamente y aplica el color del tema por defecto

import { Ionicons } from '@expo/vector-icons'
import type { StyleProp, TextStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { icons, iconSize } from '@/constants/icons'
import type { IconName, IconSizeName } from '@/constants/icons'

// Tipo del nombre de icono aceptado por Ionicons
type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

export interface IconProps {
  /** Clave del registro de iconos (ej. 'explore', 'add', 'flight') */
  name: IconName
  /** Tamaño predefinido del icono */
  size?: IconSizeName
  /** Color del icono — por defecto usa colors.text.primary del tema activo */
  color?: string
  /** Usar variante rellena (filled) en lugar de outline */
  filled?: boolean
  /** Estilos adicionales — Ionicons usa TextStyle internamente */
  style?: StyleProp<TextStyle>
}

/**
 * Icono del sistema Roamly basado en Ionicons.
 * Sigue automáticamente el color de texto primario del tema activo.
 */
export const Icon = ({
  name,
  size = 'md',
  color,
  filled = false,
  style,
}: IconProps) => {
  const { colors } = useTheme()
  const resolvedColor = color ?? colors.text.primary
  const iconName = (filled ? icons[name].filled : icons[name].outline) as IoniconsName

  return (
    <Ionicons
      name={iconName}
      size={iconSize[size]}
      color={resolvedColor}
      style={style}
    />
  )
}
