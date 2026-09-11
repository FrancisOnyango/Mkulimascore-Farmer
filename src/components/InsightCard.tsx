import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from './Card';
import { Body, Caption, H3 } from './Typography';
import { StatusPill } from './StatusPill';
import { colors, spacing } from '@/constants/theme';
import type { Insight } from '@/domain/types';
import { formatFreshness } from '@/lib/utils/format';

export function InsightCard({ insight, onPress }: { insight: Insight; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.marker} />
        <H3 style={{ flex: 1 }}>{insight.title}</H3>
        <StatusPill
          label={insight.tone === 'positive' ? 'Good' : insight.tone === 'attention' ? 'Attention' : 'Context'}
          tone={insight.tone === 'attention' ? 'attention' : insight.tone === 'positive' ? 'good' : 'neutral'}
        />
      </View>
      <Body style={styles.value}>{insight.value}</Body>
      <Body>{insight.explanation}</Body>
      {insight.observationPeriod ? <Caption style={styles.source}>Period: {insight.observationPeriod}</Caption> : null}
      <Caption style={styles.source}>{insight.sourceLabel} / {formatFreshness(insight.updatedAt)}</Caption>
      {insight.limitation ? <Caption style={styles.source}>Limitation: {insight.limitation}</Caption> : null}
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  marker: { width: 4, height: 24, borderRadius: 2, backgroundColor: colors.info, marginTop: 1 },
  value: { fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.ink },
  source: { marginTop: spacing.md }
});
