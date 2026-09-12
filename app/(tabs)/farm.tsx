import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { AskBar } from '@/components/AskBar';
import { FarmCard } from '@/components/FarmCard';
import { NearbyPlaces } from '@/components/NearbyPlaces';
import { useAppData } from '@/context/AppDataContext';
import { formatFarmArea } from '@/lib/utils/format';
import { listFarmerPlaces } from '@/db/database';
import type { AgriculturalPlace, PlaceFilter } from '@/domain/places';
import { buildFarmTwin } from '@/lib/intelligence/twin';
import { listNearbyPlaces } from '@/lib/places/nearby';
import { colors, spacing } from '@/constants/theme';

export default function Farms() {
  const { farms, enterprises, records, selectedFarmId, setSelectedFarmId, weather, climate, consents, passport, activity, markets, ready } = useAppData();
  const [placeFilter, setPlaceFilter] = useState<PlaceFilter | null>(null);
  const [farmerPlaces, setFarmerPlaces] = useState<AgriculturalPlace[]>([]);
  useEffect(() => {
    if (!ready) return;
    void listFarmerPlaces().then(setFarmerPlaces);
  }, [ready]);
  const primaryFarm = farms.find((farm) => farm.id === selectedFarmId) ?? farms[0];
  const farmEnterprises = enterprises.filter((enterprise) => enterprise.farmId === primaryFarm?.id);
  const farmRecords = records.filter((record) => !record.associatedFarmId || record.associatedFarmId === primaryFarm?.id);
  const verifiedRecords = farmRecords.filter((record) => record.status === 'verified').length;
  const twin = primaryFarm
    ? buildFarmTwin({
      passport,
      farm: primaryFarm,
      farms,
      enterprises: farmEnterprises,
      records: farmRecords,
      consents,
      weather: weather.find((item) => item.farmId === primaryFarm.id),
      climate,
      markets,
      activity
    })
    : null;
  const nearbyPlaces = useMemo(
    () => listNearbyPlaces({
      farm: primaryFarm,
      enterprises: farmEnterprises,
      liveMarkets: markets,
      extras: farmerPlaces,
      filter: placeFilter,
      limit: 8
    }),
    [farmEnterprises, farmerPlaces, markets, placeFilter, primaryFarm]
  );
  const nextSteps = primaryFarm ? [
    !primaryFarm.latitude ? 'Mark farm place' : null,
    !primaryFarm.mapped ? 'Draw or walk the farm edge' : null,
    farmEnterprises.length === 0 ? 'Add an enterprise' : null,
    farmRecords.length === 0 ? 'Add a production record' : null
  ].filter(Boolean) as string[] : [];
  return (
    <AppShell ask={{ screen: 'farm', farmId: primaryFarm?.id }}>
      <H1>My Farm</H1>
      <View style={styles.titleRow}>
        <Body style={styles.lead}>Your farms, enterprises and land — kept as your record.</Body>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a farm update" onPress={() => router.push({ pathname: '/add', params: { context: 'farm', farmId: primaryFarm?.id } })} style={styles.addButton}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <AskBar
          hint="How large is this farm? What is nearby?"
          onPress={() => router.push({ pathname: '/ask', params: { screen: 'farm', farmId: primaryFarm?.id ?? '' } })}
        />
      </View>

      <View style={styles.switcher}>
        {farms.map((farm) => (
          <Pressable
            key={farm.id}
            accessibilityRole="button"
            accessibilityState={{ selected: farm.id === primaryFarm?.id }}
            accessibilityLabel={`Select ${farm.name}`}
            onPress={() => setSelectedFarmId(farm.id)}
            style={[styles.farmChip, farm.id === primaryFarm?.id && styles.farmChipActive]}
          >
            <Text style={[styles.farmChipText, farm.id === primaryFarm?.id && styles.farmChipTextActive]}>{farm.name}</Text>
          </Pressable>
        ))}
      </View>

      {primaryFarm ? (
        <View style={{ marginTop: spacing.xl }}>
          <FarmCard
            farm={primaryFarm}
            enterprises={farmEnterprises}
            seasonLabel={twin ? twin.cycle.label : undefined}
            onPress={() => router.push(
              primaryFarm.mapped || primaryFarm.latitude != null
                ? (`/farm/${primaryFarm.id}` as never)
                : ({ pathname: '/farm/map', params: { farmId: primaryFarm.id } } as never)
            )}
          />
        </View>
      ) : null}

      {primaryFarm ? (
        <>
          <Card style={styles.progressCard}>
            <Caption>Your farm profile</Caption>
            <View style={styles.row}>
              <H3 style={{ marginTop: spacing.xs, flex: 1 }}>{twin?.health.label ?? (nextSteps.length ? 'Good progress' : 'Strong farm profile')}</H3>
              {twin ? <StatusPill label={twin.cycle.label} tone="neutral" /> : null}
            </View>
            <Body style={{ marginTop: spacing.sm }}>
              {twin?.health.line ?? (nextSteps.length
                ? `Improve by: ${nextSteps.join(' · ')}`
                : 'Location, enterprises and records are in place. Keep them current as the farm changes.')}
            </Body>
            {twin?.comparison ? <Caption style={{ marginTop: spacing.sm }}>{twin.comparison.line}</Caption> : null}
          </Card>

          <Card style={styles.overviewCard}>
            <Caption>Farm overview</Caption>
            <View style={styles.metrics}>
              <Metric label="Area" value={`${primaryFarm.measuredArea ?? (primaryFarm.reportedArea || '—')} ${primaryFarm.areaUnit}`} />
              <Metric label="Enterprises" value={`${farmEnterprises.length}`} />
              <Metric label="Verified" value={`${verifiedRecords}`} />
            </View>
          </Card>

          {primaryFarm.latitude != null && primaryFarm.longitude != null ? (
            <>
              <SectionHeader title="Near your farm" action="View all" onAction={() => router.push({ pathname: '/places', params: { farmId: primaryFarm.id } })} />
              <Caption style={{ marginBottom: spacing.sm }}>Useful for this farm — not only the nearest pin.</Caption>
              <NearbyPlaces
                places={nearbyPlaces}
                filter={placeFilter}
                onFilter={setPlaceFilter}
                farmId={primaryFarm.id}
                compact
              />
            </>
          ) : null}
        </>
      ) : null}

      <SectionHeader title="Farms" />
      <View style={{ gap: spacing.md }}>
        {farms.length === 0 ? <EmptyState title="No farm yet" body="Add a place name or use your location. You do not need to draw a boundary yet." action="Add activity" onAction={() => router.push({ pathname: '/add', params: { context: 'farm' } })} /> :
          farms.map((farm) => (
            <Card key={farm.id} onPress={() => router.push(`/farm/${farm.id}`)} style={styles.farmCard}>
              <View style={styles.farmRail} />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <H3>{farm.name}</H3>
                  <Caption>{farm.location}</Caption>
                </View>
                <StatusPill label={farm.mapped ? 'Mapped' : 'Boundary later'} tone={farm.mapped ? 'verified' : 'neutral'} />
              </View>
              <View style={styles.metrics}>
              <Metric label="Area" value={formatFarmArea(farm)} />
              <Metric label="Boundary" value={farm.mapped ? 'Farmer mapped' : 'Not mapped yet'} />
              </View>
              <Caption style={{ marginTop: spacing.lg }}>{farm.enterprises.join(' / ')}</Caption>
            </Card>
          ))}
      </View>

      <SectionHeader title="Enterprises" />
      <View style={{ gap: spacing.md }}>
        {(farmEnterprises.length ? farmEnterprises : enterprises).length ? (farmEnterprises.length ? farmEnterprises : enterprises).map((enterprise) => (
          <Card key={enterprise.id} onPress={() => router.push(`/enterprise/${enterprise.id}`)}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Caption>{enterprise.sector}</Caption>
                <H3>{enterprise.name}</H3>
                <Body style={{ marginTop: spacing.sm }}>{enterprise.summary}</Body>
              </View>
              {enterprise.primary ? <StatusPill label="Primary" tone="good" /> : null}
            </View>
            <View style={styles.rule} />
            <Caption>{enterprise.productionMetric}</Caption>
            <Body style={styles.value}>{enterprise.productionValue}</Body>
          </Card>
        )) : <EmptyState title="Nothing growing yet" body="Add dairy, maize, tea, poultry or any other farm work." action="Add" onAction={() => router.push({ pathname: '/add', params: { context: 'enterprise', farmId: primaryFarm?.id } })} />}
      </View>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Caption>{label}</Caption>
      <Body style={styles.value}>{value}</Body>
    </View>
  );
}
const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  addButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  farmChip: { minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  farmChipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  farmChipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  farmChipTextActive: { color: '#fff' },
  visualCard: { marginTop: spacing.xl, padding: 0, overflow: 'hidden' },
  locationPanel: { minHeight: 156, backgroundColor: colors.surfaceAlt, justifyContent: 'center', padding: spacing.xl },
  visualFooter: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  visualArea: { fontSize: 20, lineHeight: 26, color: colors.ink, fontWeight: '900' },
  progressCard: { marginTop: spacing.md, backgroundColor: colors.brandSoft, borderColor: '#C9E0D1' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(23,100,59,0.14)', overflow: 'hidden', marginTop: spacing.lg },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand },
  progressColumns: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
  progressText: { fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: spacing.xs },
  overviewCard: { marginTop: spacing.md },
  diaryCard: { backgroundColor: colors.surfaceAlt },
  diaryActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  diaryAction: { flex: 1, minHeight: 72, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, justifyContent: 'space-between' },
  diarySymbol: { color: colors.brand, fontWeight: '900', fontSize: 11 },
  economicsCard: { marginTop: spacing.md, backgroundColor: colors.warm, borderColor: '#E7D7AE' },
  economicsStatus: { color: colors.warmInk, fontWeight: '900' },
  economicsLink: { alignSelf: 'flex-start', marginTop: spacing.lg },
  linkText: { color: colors.info, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  farmCard: { overflow: 'hidden' },
  farmRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.brand },
  metrics: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  metricBox: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 6, padding: spacing.md },
  value: { fontWeight: '800', marginTop: 3 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: spacing.lg }
});
