import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Caption, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { colors, spacing } from '@/constants/theme';

export interface ReadinessItem {
  label: string;
  detail: string;
  state: 'complete' | 'attention' | 'missing';
}

export function ReadinessChecklist({ title, items }: { title: string; items: ReadinessItem[] }) {
  return (
    <Card>
      <H3>{title}</H3>
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {items.map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Body style={styles.label}>{item.label}</Body>
              <Caption style={{ marginTop: 3 }}>{item.detail}</Caption>
            </View>
            <StatusPill label={labelFor(item.state)} tone={item.state === 'complete' ? 'verified' : item.state === 'attention' ? 'attention' : 'neutral'} />
          </View>
        ))}
      </View>
    </Card>
  );
}

function labelFor(state: ReadinessItem['state']) {
  if (state === 'complete') return 'Ready';
  if (state === 'attention') return 'Update';
  return 'Needed';
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  label: { color: colors.ink, fontWeight: '800' }
});
