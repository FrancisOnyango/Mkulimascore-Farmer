import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

export function HomeSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={[styles.line, styles.short]} />
      <View style={[styles.line, styles.title]} />
      <View style={styles.card}>
        <View style={[styles.line, styles.medium]} />
        <View style={[styles.line, styles.title]} />
        <View style={styles.row}>
          <View style={styles.metric} />
          <View style={styles.metric} />
        </View>
      </View>
      <View style={[styles.line, styles.medium]} />
      <View style={styles.smallCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  line: { height: 12, borderRadius: radius.sm, backgroundColor: colors.line },
  short: { width: 110 },
  medium: { width: 180 },
  title: { width: 230, height: 24 },
  card: { minHeight: 210, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  metric: { flex: 1, height: 74, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  smallCard: { height: 86, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }
});
