// Campo de texto del sistema Roamly
// Soporta label, error, helper, icono, foco con borde coral y estado deshabilitado

import { useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/constants/icons'

export interface InputProps {
  /** Etiqueta visible sobre el campo */
  label: string
  /** Texto de ayuda visible dentro del campo vacío */
  placeholder?: string
  /** Valor actual del campo */
  value: string
  /** Callback invocado en cada cambio de texto */
  onChangeText: (text: string) => void
  /** Mensaje de error — aparece bajo el campo en color danger */
  error?: string
  /** Texto de ayuda opcional bajo el campo */
  helper?: string
  /** Icono opcional a la izquierda del texto */
  icon?: IconName
  /** Oculta el texto para contraseñas */
  secureTextEntry?: boolean
  /** Permite múltiples líneas de texto */
  multiline?: boolean
  /** Número de líneas visibles cuando multiline=true */
  numberOfLines?: number
  /** Si false, el campo no acepta input */
  editable?: boolean
  /** Estilos adicionales para el contenedor externo */
  style?: StyleProp<ViewStyle>
}

/**
 * Campo de texto del sistema Roamly.
 * Al recibir foco, el borde cambia a coral (#FF5A5F) con 1.5px de grosor.
 * Los errores se muestran en color danger bajo el campo.
 */
export const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helper,
  icon,
  secureTextEntry = false,
  multiline = false,
  numberOfLines,
  editable = true,
  style,
}: InputProps) => {
  const { colors, isDark } = useTheme()
  const [isFocused, setIsFocused] = useState(false)

  // Color del borde: danger si hay error, coral si tiene foco, borde estándar si no
  const borderColor = error
    ? colors.semantic.danger
    : isFocused
    ? colors.primary
    : colors.border

  const borderWidth = isFocused || error ? 1.5 : 1

  return (
    <View style={[styles.wrapper, style]}>
      {/* Etiqueta */}
      <Text
        style={[
          styles.label,
          { color: error ? colors.semantic.danger : colors.text.secondary },
        ]}
      >
        {label}
      </Text>

      {/* Campo */}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            borderWidth,
            backgroundColor: isDark
              ? colors.background.surface
              : colors.background.base,
            opacity: editable ? 1 : 0.5,
          },
        ]}
      >
        {icon && (
          <Icon
            name={icon}
            size="sm"
            color={isFocused ? colors.primary : colors.text.tertiary}
            style={styles.icon}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
          accessibilityState={{ disabled: !editable }}
          style={[
            styles.input,
            {
              color: colors.text.primary,
              paddingLeft: icon ? theme.spacing.xs : 0,
            },
            multiline && styles.multiline,
          ]}
        />
      </View>

      {/* Error o helper */}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.message, { color: colors.semantic.danger }]}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.message, { color: colors.text.tertiary }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.medium,
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  icon: {
    marginRight: theme.spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.size.base,
    paddingVertical: theme.spacing.sm + 4,
  },
  multiline: {
    textAlignVertical: 'top',
    paddingTop: theme.spacing.sm + 4,
  },
  message: {
    fontSize: theme.typography.size.sm,
    marginTop: theme.spacing.xs,
  },
})
