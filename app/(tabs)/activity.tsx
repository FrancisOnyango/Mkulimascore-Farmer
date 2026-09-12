import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Caption, H1 } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import { useAppData } from '@/context/AppDataContext';
import { activityTypes } from '@/lib/enterprises/nextAction';
import { inferFarmCycle } from '@/lib/intelligence/cycle';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

export default function Activity() {
  const { activity, enterprises, outbox } = useAppData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = enterprises.find((item) => item.id === selectedId) ?? enterprises.find((item) => item.primary) ?? enterprises[0];
  const cycle = useMemo(() => inferFarmCycle(selected ? [selected] : enterprises, activity), [activity, enterprises, selected]);
  const types = useMemo(() => activityTypes(selected?.sector, cycle.stage), [cycle.stage, selected]);
  const unsynced = outbox.filter((item) => item.state !== 'SYNCED').length;

  return (
    <AppShell>
      <View style={styles.header}>
        <View>
          <H1>Farm diary</H1>
          <Caption style={{ marginTop: 4 }}>{cycle.diaryHint}</Caption>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={() => router.push({ pathname: '/add', params: { context: 'enterprise', enterpriseId: selected?.id, farmId: selected?.farmId } })}
          style={styles.add}
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>

      {enterprises.length > 1 ? (
        <View style={styles.chips}>
          {enterprises.map((enterprise) => (
            <Pressable
              key={enterprise.id}
              onPress={() => setSelectedId(enterprise.id)}
              style={[styles.chip, enterprise.id === selected?.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, enterprise.id === selected?.id && styles.chipTextOn]}>{enterprise.sector}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.types}>
        {types.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => router.push({ pathname: item.route as never, params: { enterpriseId: selected?.id, farmId: selected?.farmId } })}
            style={styles.type}
          >
            <Text style={styles.typeText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {unsynced ? <Caption style={styles.sync}>{unsynced} waiting to send</Caption> : null}

      <FarmerSection title="Recent" action="All" onAction={() => router.push('/records')}>
        {activity.length ? activity.map((item, index) => (
          <FarmerRow
            key={item.id}
            value={item.title}
            label={formatDate(item.occurredAt)}
            detail={item.detail}
            last={index === activity.length - 1}
          />
        )) : (
          <EmptyState
            title="Nothing yet"
            body="Add milk, harvest, eggs or a sale."
            action="Add"
            onAction={() => router.push('/add')}
          />
        )}
      </FarmerSection>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  add: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  type: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.brandSoft, justifyContent: 'center', paddingHorizontal: spacing.md },
  typeText: { color: colors.brandDark, fontWeight: '800', fontSize: 15 },
  sync: { marginBottom: spacing.md }
});
