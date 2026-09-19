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
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

export default function Activity() {
  const { activity, enterprises, farms, outbox, selectedFarmId, setSelectedFarmId } = useAppData();
  const farm = farms.find((item) => item.id === selectedFarmId) ?? farms[0];
  const farmEnterprises = farm ? enterprises.filter((item) => item.farmId === farm.id) : enterprises;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = farmEnterprises.find((item) => item.id === selectedId)
    ?? farmEnterprises.find((item) => item.primary)
    ?? farmEnterprises[0]
    ?? enterprises[0];
  const cycle = useMemo(() => inferFarmCycle(selected ? [selected] : farmEnterprises, activity), [activity, farmEnterprises, selected]);
  const types = useMemo(() => activityTypes(selected?.sector, cycle.stage), [cycle.stage, selected]);
  const unsynced = outbox.filter((item) => item.state !== 'SYNCED').length;

  return (
    <AppShell ask={{ screen: 'records', farmId: selected?.farmId ?? farm?.id }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <H1>Farm diary</H1>
          <Caption style={{ marginTop: 4 }}>{cycle.diaryHint}</Caption>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={() => router.push({ pathname: '/add', params: { context: 'enterprise', enterpriseId: selected?.id, farmId: selected?.farmId ?? farm?.id } })}
          style={styles.add}
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.context}>
        <Caption style={styles.contextKicker}>Recording for</Caption>
        <Text style={styles.contextTitle}>{farm?.name || 'Your farm'}</Text>
        <Text style={styles.contextBody}>
          {[selected?.sector || selected?.name, cycle.label !== 'Not set yet' ? cycle.label : null].filter(Boolean).join(' · ') || 'Choose an enterprise before you save'}
        </Text>
      </View>

      {farms.length > 1 ? (
        <View style={styles.chips}>
          {farms.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setSelectedFarmId(item.id);
                setSelectedId(null);
              }}
              style={[styles.chip, item.id === farm?.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, item.id === farm?.id && styles.chipTextOn]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {farmEnterprises.length > 1 ? (
        <View style={styles.chips}>
          {farmEnterprises.map((enterprise) => (
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
            onPress={() => router.push({ pathname: item.route as never, params: { enterpriseId: selected?.id, farmId: selected?.farmId ?? farm?.id } })}
            style={styles.type}
          >
            <Text style={styles.typeText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {unsynced ? <Caption style={styles.sync}>{unsynced} waiting to send · Saved on this phone</Caption> : null}

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
            body="Add milk, harvest, eggs or a sale for the enterprise selected above."
            action="Add"
            onAction={() => router.push({ pathname: '/add', params: { context: 'enterprise', enterpriseId: selected?.id, farmId: selected?.farmId ?? farm?.id } })}
          />
        )}
      </FarmerSection>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  add: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  addText: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '800' },
  context: {
    backgroundColor: colors.midnight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...shadow.lift
  },
  contextKicker: { color: '#95A3EC', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  contextTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  contextBody: { color: '#DADAF0', fontSize: 14, marginTop: 2, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceGlass, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  type: { minHeight: 40, borderRadius: radius.md, backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, justifyContent: 'center', ...shadow.card },
  typeText: { color: colors.brandDark, fontWeight: '800', fontSize: 13 },
  sync: { color: colors.warmInk, fontWeight: '700', marginBottom: spacing.sm }
});
