import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Caption } from '@/components/Typography';
import { colors, spacing } from '@/constants/theme';

export function DataRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <Caption>{label}</Caption>
      <Body style={styles.value}>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.xs },
  border: { borderBottomWidth: 1, borderBottomColor: colors.line },
  value: { fontWeight: '800', color: colors.ink }
});
