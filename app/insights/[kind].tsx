import React, { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { freshnessLabel, getFreshness } from '@/lib/utils/format';

const labels: Record<string, string> = {
  farm: 'Farm',
  enterprise: 'Farm',
  geo: 'Season',
  financial: 'Financial readiness',
  weather: 'Weather',
  climate: 'Season',
  markets: 'Market',
  updates: 'Updates'
};

export default function InsightCategory() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { insights, weather, climate, markets, enterprises } = useAppData();
  const selectedKind = kind ?? '';
  const selected = useMemo(() => {
    if (selectedKind === 'climate') return insights.filter((item) => item.kind === 'geo');
    if (selectedKind === 'enterprise') return insights.filter((item) => item.kind === 'enterprise' || item.kind === 'farm');
    return insights.filter((item) => item.kind === selectedKind);
  }, [insights, selectedKind]);
  const relevantMarkets = markets.filter((item) => item.dataStatus !== 'unavailable' && enterprises.some((enterprise) => enterprise.id === item.enterpriseId || enterprise.sector === item.commodity || enterprise.name === item.enterpriseName));
  const shownMarkets = relevantMarkets.length ? relevantMarkets : markets.filter((item) => item.dataStatus !== 'unavailable');

  return (
    <AppShell>
      <H2>{labels[selectedKind] ?? 'Insights'}</H2>
      <Body style={styles.lead}>{leadFor(selectedKind)}</Body>

      {selectedKind === 'weather' ? (
        <View style={{ gap: spacing.md }}>
          {weather.length ? weather.map((item) => (
            <Card key={item.id}>
              <Caption>{item.farmName} · {item.location}</Caption>
              <H3 style={{ marginTop: spacing.xs }}>{item.condition}</H3>
              <View style={styles.metricGrid}>
                <Metric label="Rain chance" value={`${item.rainProbabilityPct}%`} />
                <Metric label="Temperature" value={`${item.temperatureLowC}–${item.temperatureHighC}°C`} />
              </View>
              <View style={styles.forecastStrip}>
                {item.forecast.slice(0, 5).map((day) => (
                  <View key={day.day} style={styles.forecastDay}>
                    <Caption>{day.day}</Caption>
                    <Body style={styles.forecastTemp}>{day.temperatureHighC}°</Body>
                    <Caption>{day.rainProbabilityPct}%</Caption>
                  </View>
                ))}
              </View>
              <Body style={{ marginTop: spacing.lg }}>{item.fieldActivityNote}</Body>
              <Caption style={{ marginTop: spacing.md }}>{freshnessLabel(item.updatedAt)}</Caption>
            </Card>
          )) : <EmptyState title="Weather is not available yet" body="Add a farm location, then refresh when you have a connection." />}
        </View>
      ) : null}

      {selectedKind === 'climate' ? (
        <View style={{ gap: spacing.md }}>
          {climate.length ? climate.map((item) => (
            <Card key={item.id}>
              <Caption>{item.period}</Caption>
              <H3 style={{ marginTop: spacing.xs }}>{item.title}</H3>
              <Body style={{ marginTop: spacing.md }}>{item.interpretation}</Body>
              <Caption style={{ marginTop: spacing.md }}>{item.sourceLabel} · {freshnessLabel(item.updatedAt)}</Caption>
            </Card>
          )) : <EmptyState title="Seasonal context unavailable" body="This appears only when we have a reliable location-based source." />}
        </View>
      ) : null}

      {selectedKind === 'markets' ? (
        <View style={{ gap: spacing.md }}>
          {shownMarkets.length ? shownMarkets.map((item) => {
            const stale = getFreshness(item.updatedAt)?.state === 'stale';
            return (
              <Card key={item.id}>
                <Caption>{item.marketScope}</Caption>
                <H3 style={{ marginTop: spacing.xs }}>{item.commodity}</H3>
                <Body style={styles.price}>{item.localRange ?? item.observedPrice}</Body>
                {item.farmerRecordedPrice ? <Caption style={{ marginTop: spacing.sm }}>Your last recorded price: {item.farmerRecordedPrice}</Caption> : null}
                <Caption style={{ marginTop: spacing.md }}>
                  {stale ? 'This saved price may be old. ' : ''}
                  {item.sourceLabel ?? 'Source not given'} · {freshnessLabel(item.updatedAt)}
                </Caption>
              </Card>
            );
          }) : <EmptyState title="Market price unavailable" body="We only show prices when a source exists for your enterprises." />}
        </View>
      ) : null}

      {selectedKind !== 'weather' && selectedKind !== 'climate' && selectedKind !== 'markets' ? (
        <View style={{ gap: spacing.md }}>
          {selected.length ? selected.map((item) => (
            <Card key={item.id}>
              <H3>{item.title}</H3>
              <Body style={{ marginTop: spacing.sm }}>{item.explanation}</Body>
              <Caption style={{ marginTop: spacing.md }}>{item.sourceLabel} · {freshnessLabel(item.updatedAt)}</Caption>
              {item.limitation ? <Caption style={{ marginTop: spacing.xs }}>{item.limitation}</Caption> : null}
              <Pressable accessibilityRole="button" onPress={() => router.push(actionRoute(item.kind) as never)} style={styles.actionButton}>
                <Text style={styles.actionText}>{item.action ?? 'Review'}</Text>
              </Pressable>
            </Card>
          )) : <EmptyState title="Nothing to show yet" body="This view appears when we have records or a farm location to work from." action="Go to My Farm" onAction={() => router.push('/(tabs)/farm')} />}
        </View>
      ) : null}
    </AppShell>
  );
}

function leadFor(kind: string) {
  if (kind === 'weather') return 'Location-based conditions for your farm. Forecasts can change.';
  if (kind === 'markets') return 'Prices are shown only with a source and a date. A missing price is better than a guessed one.';
  if (kind === 'financial') return 'This is not a loan offer. It only describes how complete your farm information is.';
  if (kind === 'climate') return 'Seasonal context when a reliable location source exists.';
  return 'Information tied to your farm and records.';
}

function actionRoute(kind: string) {
  if (kind === 'geo' || kind === 'farm') return '/(tabs)/farm';
  if (kind === 'enterprise') return '/add/production';
  if (kind === 'financial') return '/passport';
  return '/add';
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Caption>{label}</Caption>
      <Body style={styles.metricValue}>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  metricGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  metric: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  metricValue: { color: colors.ink, fontWeight: '800', marginTop: 4 },
  forecastStrip: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  forecastDay: { flex: 1, minHeight: 74, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  forecastTemp: { color: colors.ink, fontWeight: '800', marginTop: 2 },
  price: { marginTop: spacing.md, fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.ink },
  actionButton: { alignSelf: 'flex-start', marginTop: spacing.lg, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.brandDark, justifyContent: 'center', paddingHorizontal: spacing.lg },
  actionText: { color: '#fff', fontWeight: '800' }
});
