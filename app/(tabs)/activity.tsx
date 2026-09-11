import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1 } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import { useAppData } from '@/context/AppDataContext';
import { strings } from '@/constants/strings';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';
import type { FarmSector } from '@/domain/types';

const DAIRY_TYPES = [
  { label: 'Record milk', route: '/add/production' },
  { label: 'Milk sale', route: '/add/sale' },
  { label: 'Feed purchase', route: '/add/cost' },
  { label: 'Vet visit', route: '/add/record' }
];
const CROP_TYPES = [
  { label: 'Planted', route: '/add/production' },
  { label: 'Input purchase', route: '/add/cost' },
  { label: 'Harvest', route: '/add/production' },
  { label: 'Sale', route: '/add/sale' }
];
const POULTRY_TYPES = [
  { label: 'Flock update', route: '/add/production' },
  { label: 'Feed purchase', route: '/add/cost' },
  { label: 'Sale', route: '/add/sale' }
];
const DEFAULT_TYPES = [
  { label: 'Production', route: '/add/production' },
  { label: 'Sale', route: '/add/sale' },
  { label: 'Cost', route: '/add/cost' },
  { label: 'Photo / record', route: '/add/record' }
];

const CROP_SECTORS: FarmSector[] = ['Maize', 'Coffee', 'Tea', 'Avocado', 'Rice', 'Irish potatoes', 'Tomato', 'Beans', 'Macadamia'];

export default function Activity() {
  const { activity, enterprises, outbox } = useAppData();
  const primary = enterprises.find((item) => item.primary) ?? enterprises[0];
  const types = useMemo(() => {
    if (primary?.sector === 'Dairy') return DAIRY_TYPES;
    if (primary?.sector === 'Poultry') return POULTRY_TYPES;
    if (primary && CROP_SECTORS.includes(primary.sector)) return CROP_TYPES;
    return DEFAULT_TYPES;
  }, [primary]);
  const unsynced = outbox.filter((item) => item.state !== 'SYNCED').length;

  return (
    <AppShell>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <H1>Activity</H1>
          <Body style={styles.lead}>Your farm diary. Add what happened. We keep it as added by you until it is confirmed.</Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add activity"
          onPress={() => router.push({ pathname: '/add', params: { context: 'enterprise', enterpriseId: primary?.id, farmId: primary?.farmId } })}
          style={styles.add}
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.types}>
        {types.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => router.push({ pathname: item.route as never, params: { enterpriseId: primary?.id, farmId: primary?.farmId } })}
            style={styles.type}
          >
            <Text style={styles.typeText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {unsynced ? <Caption style={styles.sync}>{unsynced} saved on this phone · will sync when you are online</Caption> : null}

      <FarmerSection title="Recent" action="Records" onAction={() => router.push('/records')}>
        {activity.length ? activity.map((item, index) => (
          <FarmerRow
            key={item.id}
            value={item.title}
            label={formatDate(item.occurredAt)}
            detail={item.detail}
            status="Added by you"
            last={index === activity.length - 1}
          />
        )) : (
          <EmptyState
            title={strings.empty.activity}
            body={strings.empty.activityBody}
            action={strings.empty.addActivity}
            onAction={() => router.push('/add')}
          />
        )}
      </FarmerSection>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  lead: { color: colors.muted, marginTop: spacing.sm },
  add: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '800' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  type: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  typeText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  sync: { marginBottom: spacing.md }
});
