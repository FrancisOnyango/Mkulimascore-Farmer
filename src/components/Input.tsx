import React from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

export function Input({
  label,
  hint,
  error,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        autoCorrect={props.autoCorrect ?? false}
        autoComplete={props.autoComplete ?? 'off'}
        {...props}
        style={[styles.input, props.multiline && styles.multiline, props.style]}
        accessibilityLabel={props.accessibilityLabel ?? label}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function keyboardFor(kind?: 'default' | 'numeric' | 'decimal-pad'): KeyboardTypeOptions {
  if (kind === 'numeric') return 'number-pad';
  if (kind === 'decimal-pad') return 'decimal-pad';
  return 'default';
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 17
  },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  hint: { marginTop: spacing.xs, color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { marginTop: spacing.xs, color: colors.danger, fontSize: 14, fontWeight: '700' }
});
