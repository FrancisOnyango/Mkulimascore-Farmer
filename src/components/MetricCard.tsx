import React from 'react';
import { StyleSheet } from 'react-native';
import { Card } from './Card';
import { Body, Caption } from './Typography';
import { colors, spacing } from '@/constants/theme';

export function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card style={styles.card}>
      <Caption>{label}</Caption>
      <Body style={styles.value}>{value}</Body>
      {note ? <Caption>{note}</Caption> : null}
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 145 },
  value: { marginTop: spacing.sm, marginBottom: 2, fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.ink }
});
