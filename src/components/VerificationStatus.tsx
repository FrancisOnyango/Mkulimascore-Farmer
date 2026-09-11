import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/constants/theme';
import { verificationShort } from '@/lib/copy/status';
import type { VerificationState } from '@/domain/types';

export function VerificationStatus({
  state,
  label
}: {
  state?: VerificationState | string;
  label?: string;
}) {
  const text = label ?? verificationShort(state);
  const icon = state === 'verified' || state === 'supported' ? 'checkmark-circle-outline' : state === 'needs_review' ? 'alert-circle-outline' : 'create-outline';
  const color = state === 'verified' || state === 'supported' ? colors.success : state === 'needs_review' ? colors.warning : colors.muted;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={text} style={styles.row}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '700' }
});
