import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import type { Farm, FieldLook } from '@/domain/types';
import { nearestMarkets } from '@/lib/markets/kenyaMarkets';
import { locationEvidence } from '@/lib/geo/locationLevel';
import { advancedFieldInsights } from '@/lib/eo/farmerCopy';
import { buildFarmTwin } from '@/lib/intelligence/twin';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate, freshnessLabel } from '@/lib/utils/format';

export default function FarmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const { enterprises, records, weather, climate, farms, consents, passport, activity, markets, refresh } = useAppData();
  const [basemap, setBasemap] = useState<'map' | 'satellite'>('satellite');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const fromContext = farms.find((item) => item.id === id);
    if (fromContext) setFarm(fromContext);
    else if (id) void FarmerAppService.getFarm(id).then(setFarm);
  }, [id, farms]);

  if (!farm) return <AppShell><Body>Loading farm...</Body></AppShell>;

  const farmEnterprises = enterprises.filter((enterprise) => enterprise.farmId === farm.id);
  const farmRecords = records.filter((record) => record.associatedFarmId === farm.id || (!record.associatedFarmId && farmEnterprises.some((enterprise) => record.associatedEnterpriseId === enterprise.id)));
  const farmWeather = weather.find((item) => item.farmId === farm.id);
  const nearby = farm.latitude != null && farm.longitude != null
    ? nearestMarkets({ latitude: farm.latitude, longitude: farm.longitude }, 2)
    : [];
  const nearest = nearby[0];
  const place = locationEvidence(farm);
  const advanced = advancedFieldInsights(farm, climate);
  const twin = buildFarmTwin({
    passport,
    farm,
    farms,
    enterprises: farmEnterprises,
    records: farmRecords,
    consents,
    weather: farmWeather,
    climate,
    markets,
    activity
  });

  async function saveLook(look: FieldLook) {
    if (!farm) return;
    const next = await FarmerAppService.saveFieldLook(farm.id, look);
    setFarm(next);
    await refresh();
  }

  return (
    <AppShell>
      <Eyebrow>My Farm</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{farm.name}</H2>
      <Caption>{farm.location}</Caption>

      <View style={styles.modes}>
        <Pressable onPress={() => setBasemap('satellite')} style={[styles.mode, basemap === 'satellite' && styles.modeOn]}><Text style={[styles.modeText, basemap === 'satellite' && styles.modeTextOn]}>Satellite</Text></Pressable>
        <Pressable onPress={() => setBasemap('map')} style={[styles.mode, basemap === 'map' && styles.modeOn]}><Text style={[styles.modeText, basemap === 'map' && styles.modeTextOn]}>Map</Text></Pressable>
      </View>
      <FarmPlaceMap
        farm={farm}
        basemap={basemap}
        nearby={nearby.map((market) => ({
          name: market.name,
          latitude: market.latitude,
          longitude: market.longitude,
          distanceLabel: market.distanceLabel
        }))}
        height={260}
      />

      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton
          label={farm.mapped ? 'Edit farm place' : farm.latitude ? 'Draw or walk the edge' : 'Mark farm place'}
          onPress={() => router.push({ pathname: '/farm/map', params: { farmId: farm.id } })}
        />
      </View>

      <View style={styles.pills}>
        <StatusPill label={place.label} tone={place.level >= 2 ? 'verified' : 'neutral'} />
        <StatusPill label={farm.verification === 'verified' ? 'Verified during farm visit' : farm.verification === 'supported' ? 'Confirmed by your cooperative' : 'Added by you'} tone={farm.verification === 'verified' || farm.verification === 'supported' ? 'verified' : 'neutral'} />
        {farm.lastAccuracyM != null ? <StatusPill label={`GPS ${Math.round(farm.lastAccuracyM)} m`} tone={farm.lastAccuracyM <= 30 ? 'verified' : 'attention'} /> : null}
      </View>
      <Caption style={{ marginTop: spacing.sm }}>{place.detail}</Caption>

      <Card style={{ marginTop: spacing.xl }}>
        <Caption>This farm today</Caption>
        <View style={styles.pills}>
          <StatusPill
            label={twin.health.label}
            tone={twin.health.level === 'attention' ? 'attention' : twin.health.level === 'watch' ? 'attention' : 'good'}
          />
          <StatusPill label={twin.cycle.label} tone="neutral" />
        </View>
        <Body style={{ marginTop: spacing.sm }}>{twin.health.line}</Body>
        <Caption style={{ marginTop: spacing.sm }}>{twin.cycle.line}</Caption>
        {twin.income.line ? <Caption style={{ marginTop: spacing.sm }}>{twin.income.line}</Caption> : null}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Metric label="Area you entered" value={farm.reportedArea ? `${farm.reportedArea} ${farm.areaUnit}` : 'Not set'} />
        <Metric label="Measured area" value={farm.measuredArea ? `${farm.measuredArea} ${farm.areaUnit}` : 'Not measured yet'} />
        <Metric label="Boundary" value={farm.mapped ? boundarySourceLabel(farm.boundarySource) : 'Detailed boundary not yet mapped'} />
        <Metric label="Enterprises" value={farm.enterprises.join(' · ') || 'None yet'} last />
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

      <FarmerSection title="Around this farm" detail="Weather and the nearest market from your saved place.">
        <FarmerRow
          value={farmWeather ? farmWeather.condition : 'Weather needs a farm place'}
          label={farmWeather ? `${farmWeather.rainProbabilityPct}% rain · ${farmWeather.temperatureLowC}–${farmWeather.temperatureHighC}°C` : 'Mark a point to use live weather.'}
          detail={farmWeather?.fieldActivityNote}
          status={farmWeather ? freshnessLabel(farmWeather.updatedAt) : undefined}
          tone={farmWeather && farmWeather.rainProbabilityPct >= 60 ? 'attention' : 'neutral'}
          onPress={() => router.push('/insights/weather')}
          last={!nearest}
        />
        {nearest ? (
          <FarmerRow
            value={nearest.name}
            label={`${nearest.distanceLabel} · ${nearest.town}`}
            detail={`Closest of the markets we know. ${nearest.goods.slice(0, 3).join(', ')}.`}
            status="By distance"
            tone="good"
            onPress={() => router.push('/insights/markets')}
            last
          />
        ) : null}
      </FarmerSection>

      {farm.mapped && !farm.fieldLook ? (
        <Card style={{ marginTop: spacing.md, backgroundColor: colors.brandSoft }}>
          <H3>Does this land look planted now?</H3>
          <Body style={{ marginTop: spacing.sm }}>Your eye checks what a satellite can only guess. One tap. Added by you.</Body>
          <View style={styles.looks}>
            {([
              ['planted', 'Planted'],
              ['mixed', 'Mixed'],
              ['bare', 'Bare']
            ] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => void saveLook(value)} style={styles.look} accessibilityRole="button" accessibilityLabel={label}>
                <Text style={styles.lookText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : farm.fieldLook ? (
        <Caption style={{ marginTop: spacing.md }}>Field look: {lookLabel(farm.fieldLook)}. Added by you.</Caption>
      ) : null}

      {advanced.length ? (
        <Card style={{ marginTop: spacing.md }}>
          <Pressable onPress={() => setShowAdvanced((value) => !value)} accessibilityRole="button">
            <H3>Advanced field insights</H3>
            <Caption style={{ marginTop: spacing.xs }}>{showAdvanced ? 'Hide' : 'For agronomists and field officers'}</Caption>
          </Pressable>
          {showAdvanced ? advanced.map((item) => (
            <View key={item.title} style={{ marginTop: spacing.md }}>
              <Body style={{ fontWeight: '800' }}>{item.title}</Body>
              <Caption>{item.period} · {item.sourceLabel}</Caption>
              <Body style={{ marginTop: spacing.xs }}>{item.interpretation}</Body>
            </View>
          )) : null}
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

      {farmRecords.length ? (
        <FarmerSection title="Recent records" detail="Evidence tied to this farm.">
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
      ) : null}

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

function lookLabel(look: FieldLook) {
  if (look === 'planted') return 'looks planted';
  if (look === 'mixed') return 'mixed planted and open';
  return 'looks bare';
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  metric: { paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  border: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  modes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  mode: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  modeText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  modeTextOn: { color: '#fff' },
  looks: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  look: { flex: 1, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  lookText: { color: '#fff', fontWeight: '800' }
});
