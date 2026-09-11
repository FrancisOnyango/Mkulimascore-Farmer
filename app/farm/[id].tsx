import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LiveFarmMap } from '@/components/LiveFarmMap';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import type { Farm } from '@/domain/types';
import { colors, spacing } from '@/constants/theme';
import { formatDate, freshnessLabel } from '@/lib/utils/format';

export default function FarmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const { enterprises, records, weather } = useAppData();
  useEffect(() => { if (id) void FarmerAppService.getFarm(id).then(setFarm); }, [id]);
  if (!farm) return <AppShell><Body>Loading farm...</Body></AppShell>;
  const farmEnterprises = enterprises.filter((enterprise) => enterprise.farmId === farm.id);
  const farmRecords = records.filter((record) => record.associatedFarmId === farm.id || (!record.associatedFarmId && farmEnterprises.some((enterprise) => record.associatedEnterpriseId === enterprise.id)));
  const farmWeather = weather.find((item) => item.farmId === farm.id);

  return (
    <AppShell>
      <Eyebrow>My Farm</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{farm.name}</H2>
      <Caption>{farm.location}</Caption>

      <LiveFarmMap farm={farm} />

      <View style={styles.pills}>
        <StatusPill label={farm.mapped ? 'Mapped' : 'Detailed boundary not yet mapped'} tone={farm.mapped ? 'verified' : 'neutral'} />
        <StatusPill label={farm.verification === 'verified' ? 'Verified during farm visit' : farm.verification === 'supported' ? 'Confirmed by your cooperative' : 'Added by you'} tone={farm.verification === 'verified' || farm.verification === 'supported' ? 'verified' : 'neutral'} />
      </View>

      <Card style={{ marginTop: spacing.xl }}>
        <Metric label="Area you entered" value={farm.reportedArea ? `${farm.reportedArea} ${farm.areaUnit}` : 'Not set'} />
        <Metric label="Measured area" value={farm.measuredArea ? `${farm.measuredArea} ${farm.areaUnit}` : 'Not measured yet'} />
        <Metric label="Boundary" value={farm.mapped ? boundarySourceLabel(farm.boundarySource) : 'Detailed boundary not yet mapped'} />
        <Metric label="Enterprises" value={farm.enterprises.join(' · ') || 'None yet'} />
        <Metric label="Water" value={farm.waterSource ?? 'Not recorded'} last />
      </Card>

      {farm.measuredArea != null && farm.reportedArea > 0 && Math.abs(farm.measuredArea - farm.reportedArea) >= 0.1 ? (
        <Card style={{ marginTop: spacing.md, backgroundColor: colors.warm }}>
          <H3>Farm size needs review</H3>
          <Body style={{ marginTop: spacing.sm }}>You entered: {farm.reportedArea} {farm.areaUnit}</Body>
          <Body>Field measurement: {farm.measuredArea} {farm.areaUnit}</Body>
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="Request review" variant="secondary" onPress={() => router.push('/add/correction')} />
          </View>
        </Card>
      ) : null}

      {!farm.mapped ? (
        <Card style={{ marginTop: spacing.md }}>
          <H3>Map my farm boundary</H3>
          <Body style={{ marginTop: spacing.sm }}>You can walk the boundary, draw it, or wait for a farm visit. We will not save a misleading shape if GPS is poor.</Body>
        </Card>
      ) : null}

      <FarmerSection title="Enterprises on this farm" detail="Activities connected to this farm profile." action="Add update" onAction={() => router.push({ pathname: '/add', params: { context: 'farm', farmId: farm.id } })}>
        {farmEnterprises.length ? farmEnterprises.map((enterprise, index) => (
          <FarmerRow
            key={enterprise.id}
            value={`${enterprise.sector}: ${enterprise.name}`}
            label={enterprise.productionValue}
            detail={enterprise.summary}
            status={enterprise.primary ? 'Primary' : 'Active'}
            tone={enterprise.primary ? 'verified' : 'good'}
            onPress={() => router.push(`/enterprise/${enterprise.id}`)}
            last={index === farmEnterprises.length - 1}
          />
        )) : (
          <FarmerRow value="No enterprise linked" label="Add your main crop or livestock activity to make this farm profile useful." onPress={() => router.push({ pathname: '/add', params: { context: 'farm', farmId: farm.id } })} last />
        )}
      </FarmerSection>

      <FarmerSection title="Farm signals" detail="Weather and evidence tied to this farm.">
        <FarmerRow
          value={farmWeather ? farmWeather.condition : 'Weather pending'}
          label={farmWeather ? `${farmWeather.rainProbabilityPct}% rain / ${farmWeather.rainMm} mm` : 'Coordinates are needed for live weather.'}
          detail={farmWeather?.fieldActivityNote}
          status={farmWeather ? freshnessLabel(farmWeather.updatedAt) : undefined}
          tone={farmWeather && farmWeather.rainProbabilityPct >= 60 ? 'attention' : 'neutral'}
          onPress={farmWeather ? () => router.push('/insights/weather') : undefined}
          last={!farmRecords.length}
        />
        {farmRecords.slice(0, 3).map((record, index) => (
          <FarmerRow
            key={record.id}
            value={record.title}
            label={`${record.source} / ${formatDate(record.documentDate)}`}
            status={record.status === 'verified' ? 'Verified' : 'Saved'}
            tone={record.status === 'verified' ? 'verified' : 'neutral'}
            onPress={() => router.push(`/records/${record.id}`)}
            last={index === Math.min(farmRecords.length, 3) - 1}
          />
        ))}
      </FarmerSection>

      <Card style={{ marginTop: spacing.md, backgroundColor: colors.warm }}>
        <H3>Something incorrect?</H3>
        <Body style={{ marginTop: spacing.sm }}>Ask for a review. Confirmed details are not changed quietly.</Body>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Request a correction" variant="secondary" onPress={() => router.push('/add/correction')} />
        </View>
      </Card>
    </AppShell>
  );
}
function boundarySourceLabel(source?: Farm['boundarySource']) {
  if (source === 'GPS_WALK') return 'GPS walk';
  if (source === 'DRAWN') return 'Drawn by farmer';
  if (source === 'IMPORT') return 'Imported boundary';
  if (source === 'DEMO') return 'Demo boundary';
  return 'Not captured';
}
function Metric({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.metric, !last && styles.border]}><Caption>{label}</Caption><Body style={{ fontWeight: '800' }}>{value}</Body></View>;
}
const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metric: { paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  border: { borderBottomColor: colors.line, borderBottomWidth: 1 }
});
