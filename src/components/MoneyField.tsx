import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

export function MoneyField({
  label,
  value,
  onChangeText,
  hint,
  error,
  placeholder = '8,500'
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  error?: string | null;
  placeholder?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.unit}><Text style={styles.unitText}>KES</Text></View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          style={styles.input}
          accessibilityLabel={label}
        />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  unit: { minWidth: 64, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  unitText: { color: colors.brandDark, fontWeight: '800' },
  input: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 17
  },
  hint: { marginTop: spacing.xs, color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { marginTop: spacing.xs, color: colors.danger, fontSize: 14, fontWeight: '700' }
});
