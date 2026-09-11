import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { useAppData } from '@/context/AppDataContext';
import { LiveFarmMap } from '@/components/LiveFarmMap';
import { colors, spacing } from '@/constants/theme';

export default function Farms() {
  const { farms, enterprises, records, selectedFarmId, setSelectedFarmId } = useAppData();
  const primaryFarm = farms.find((farm) => farm.id === selectedFarmId) ?? farms[0];
  const farmEnterprises = enterprises.filter((enterprise) => enterprise.farmId === primaryFarm?.id);
  const farmRecords = records.filter((record) => !record.associatedFarmId || record.associatedFarmId === primaryFarm?.id);
  const verifiedRecords = farmRecords.filter((record) => record.status === 'verified').length;
  const nextSteps = primaryFarm ? [
    !primaryFarm.latitude ? 'Add farm location' : null,
    !primaryFarm.mapped ? 'Detailed boundary not yet mapped' : null,
    farmEnterprises.length === 0 ? 'Add an enterprise' : null,
    farmRecords.length === 0 ? 'Add a production record' : null
  ].filter(Boolean) as string[] : [];
  return (
    <AppShell>
      <H1>My Farm</H1>
      <View style={styles.titleRow}>
        <Body style={styles.lead}>Your farms, enterprises and land — kept as your record.</Body>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a farm update" onPress={() => router.push({ pathname: '/add', params: { context: 'farm', farmId: primaryFarm?.id } })} style={styles.addButton}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
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
        <Card style={styles.visualCard}>
          {primaryFarm.latitude !== undefined && primaryFarm.longitude !== undefined ? (
            <LiveFarmMap farm={primaryFarm} />
          ) : (
            <View style={styles.locationPanel}>
              <H3>Detailed boundary not yet mapped</H3>
              <Caption style={{ marginTop: spacing.sm }}>A point or place name is enough for now. You can map the boundary later.</Caption>
            </View>
          )}
          <View style={styles.visualFooter}>
            <View>
              <H3>{primaryFarm.name}</H3>
              <Caption>{primaryFarm.location}</Caption>
            </View>
            <Body style={styles.visualArea}>{primaryFarm.measuredArea ?? primaryFarm.reportedArea} {primaryFarm.areaUnit}</Body>
          </View>
        </Card>
      ) : null}

      {primaryFarm ? (
        <>
          <Card style={styles.progressCard}>
            <Caption>Your farm profile</Caption>
            <H3 style={{ marginTop: spacing.xs }}>{nextSteps.length ? 'Good progress' : 'Strong farm profile'}</H3>
            <Body style={{ marginTop: spacing.sm }}>
              {nextSteps.length
                ? `Improve by: ${nextSteps.join(' · ')}`
                : 'Location, enterprises and records are in place. Keep them current as the farm changes.'}
            </Body>
          </Card>

          <Card style={styles.overviewCard}>
            <Caption>Farm overview</Caption>
            <View style={styles.metrics}>
              <Metric label="Area" value={`${primaryFarm.measuredArea ?? (primaryFarm.reportedArea || '—')} ${primaryFarm.areaUnit}`} />
              <Metric label="Enterprises" value={`${farmEnterprises.length}`} />
              <Metric label="Verified" value={`${verifiedRecords}`} />
            </View>
          </Card>
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
                <Metric label="Reported area" value={`${farm.reportedArea} ${farm.areaUnit}`} />
                <Metric label="Measured" value={`${farm.measuredArea ?? '-'} ${farm.measuredArea ? farm.areaUnit : ''}`} />
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
        )) : <EmptyState title="No enterprises yet" body="Dairy, maize, tea and other activities live here once you add them." action="Add activity" onAction={() => router.push({ pathname: '/add', params: { context: 'enterprise', farmId: primaryFarm?.id } })} />}
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
