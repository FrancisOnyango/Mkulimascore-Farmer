import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Caption, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import type { OutboxItem } from '@/domain/types';
import { spacing } from '@/constants/theme';
import { formatFreshness } from '@/lib/utils/format';
import { syncLabel } from '@/lib/copy/status';

export function OutboxCard({ item }: { item: OutboxItem }) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <H3>{operationLabel(item.operationType)}</H3>
          <Caption>{syncLabel(item.state)}</Caption>
          <Caption style={{ marginTop: spacing.xs }}>{item.state === 'SYNCED' ? formatFreshness(item.updatedAt) : 'Will sync when you are online.'}</Caption>
        </View>
        <StatusPill label={syncLabel(item.state)} tone={toneFor(item.state)} />
      </View>
    </Card>
  );
}

function toneFor(state: OutboxItem['state']) {
  if (state === 'SYNCED') return 'verified';
  if (state === 'FAILED' || state === 'RETRY') return 'attention';
  if (state === 'CONFLICT') return 'danger';
  return 'neutral';
}

function statusLabel(state: OutboxItem['state']) {
  if (state === 'SYNCED') return 'Uploaded';
  if (state === 'PENDING' || state === 'LOCAL') return 'Waiting to sync';
  if (state === 'SYNCING') return 'Sending';
  if (state === 'RETRY') return 'Will retry';
  if (state === 'FAILED') return 'Needs attention';
  if (state === 'CONFLICT') return 'Needs review';
  return 'Queued';
}

function operationLabel(operationType: string) {
  const value = operationType.toLowerCase();
  if (value.includes('production')) return 'Production update';
  if (value.includes('sale')) return 'Sale record';
  if (value.includes('cost')) return 'Cost record';
  if (value.includes('evidence')) return 'Evidence upload';
  if (value.includes('correction')) return 'Correction request';
  if (value.includes('consent')) return 'Permission update';
  if (value.includes('place')) return 'Place added';
  return 'Farm update';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }
});
