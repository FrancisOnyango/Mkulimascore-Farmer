import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

export function PrimaryButton({ label, onPress, disabled = false, variant = 'primary' }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const background = variant === 'primary' ? colors.brandDark : variant === 'danger' ? colors.claySoft : colors.surfaceGlass;
  const foreground = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.brandDark;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [
      styles.button,
      { backgroundColor: background, borderColor: variant === 'secondary' ? colors.line : background },
      disabled && { opacity: 0.45 },
      pressed && { opacity: 0.85 }
    ]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <Text maxFontSizeMultiplier={1.25} style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, borderWidth: 1 },
  label: { fontSize: 15, fontWeight: '800', letterSpacing: 0 }
});
