import React, { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AskBar } from '@/components/AskBar';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { linkedMarkets } from '@/lib/markets/linkage';
import { marketOpportunities, priceHonesty } from '@/lib/markets/opportunity';
import type { FarmerMarketNote } from '@/domain/types';
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
  const { insights, weather, climate, markets, enterprises, farms, selectedFarmId, refresh } = useAppData();
  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? farms[0];
  const [notes, setNotes] = useState<FarmerMarketNote[]>([]);
  const [priceKes, setPriceKes] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  useEffect(() => {
    void FarmerAppService.listFarmerMarketNotes().then(setNotes);
  }, [kind]);
  const linkage = linkedMarkets({ farm: selectedFarm, enterprises, liveMarkets: markets, farmerNotes: notes });
  const opportunities = marketOpportunities({ farm: selectedFarm, enterprises, liveMarkets: markets, farmerNotes: notes, limit: 3 });
  const selectedKind = kind ?? '';
  const selected = useMemo(() => {
    if (selectedKind === 'climate') return insights.filter((item) => item.kind === 'geo');
    if (selectedKind === 'enterprise') return insights.filter((item) => item.kind === 'enterprise' || item.kind === 'farm');
    return insights.filter((item) => item.kind === selectedKind);
  }, [insights, selectedKind]);
  const farmSectors = new Set<string>(enterprises.map((enterprise) => enterprise.sector));
  const shownMarkets = markets
    .filter((item) => item.dataStatus !== 'unavailable')
    .sort((a, b) => Number(farmSectors.has(b.commodity)) - Number(farmSectors.has(a.commodity)));
  const farmWeather = selectedFarm ? weather.filter((item) => item.farmId === selectedFarm.id) : weather;

  return (
    <AppShell>
      <H2>{labels[selectedKind] ?? 'Insights'}</H2>
      <Body style={styles.lead}>{leadFor(selectedKind)}</Body>
      {selectedKind === 'weather' || selectedKind === 'markets' ? (
        <View style={{ marginTop: spacing.md }}>
          <AskBar
            hint={selectedKind === 'weather' ? 'Will it rain on this farm?' : 'Where should I sell near this farm?'}
            onPress={() => router.push({ pathname: '/ask', params: { screen: selectedKind, farmId: selectedFarm?.id ?? '' } })}
          />
        </View>
      ) : null}

      {selectedKind === 'weather' ? (
        <View style={{ gap: spacing.md }}>
          {farmWeather.length ? farmWeather.map((item) => (
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
          )) : <EmptyState title="Weather is not available yet" body="Mark a farm place, then refresh when you have a connection." action="Farm place" onAction={() => router.push(selectedFarm ? `/farm/map?farmId=${selectedFarm.id}` : '/(tabs)/farm')} />}
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
          {shownMarkets.length ? (
            <Card>
              <Caption>Produce near your farm</Caption>
              <H3 style={{ marginTop: spacing.xs }}>Latest reported prices</H3>
              <Body style={{ marginTop: spacing.sm }}>Ministry of Agriculture (KAMIS). Not a live shop offer. Your crops are listed first.</Body>
            </Card>
          ) : null}
          {opportunities.length ? opportunities.map((market, index) => (
            <Card key={market.id}>
              <Caption>Option {index + 1} · from your farm place</Caption>
              <H3 style={{ marginTop: spacing.xs }}>{market.name}</H3>
              <Body style={{ marginTop: spacing.sm }}>{market.distanceLabel} · {market.town}</Body>
              <Body style={{ marginTop: spacing.sm }}>{market.priceLabel ?? 'No reported price yet'}</Body>
              <Caption style={{ marginTop: spacing.sm }}>{market.freshnessLabel}</Caption>
            </Card>
          )) : (
            <EmptyState title="Mark a farm place first" body="Nearest markets appear when the farm has a point or shape." action="Farm place" onAction={() => router.push(selectedFarm ? `/farm/map?farmId=${selectedFarm.id}` : '/(tabs)/farm')} />
          )}
          {selectedFarm && opportunities.length ? (
            <PrimaryButton label="Compare on map" variant="secondary" onPress={() => router.push({ pathname: '/farm/compare', params: { farmId: selectedFarm.id } })} />
          ) : null}
          {selectedFarm && linkage.nearest[0] ? (
            <Card>
              <H3>What did you get today?</H3>
              <Body style={{ marginTop: spacing.sm }}>Your price helps other farmers nearby. Added by you — not a live market feed.</Body>
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  label={`Price at ${linkage.nearest[0].name}`}
                  value={priceKes}
                  onChangeText={setPriceKes}
                  keyboardType="decimal-pad"
                  placeholder="KES"
                />
                <PrimaryButton
                  label={savingPrice ? 'Saving...' : `Save ${enterprises[0]?.sector ?? 'crop'} price`}
                  disabled={savingPrice || !priceKes.trim()}
                  onPress={() => {
                    void (async () => {
                      setSavingPrice(true);
                      try {
                        const nearest = linkage.nearest[0];
                        if (!nearest) return;
                        await FarmerAppService.saveFarmerMarketNote({
                          farmId: selectedFarm.id,
                          marketId: nearest.id,
                          marketName: nearest.name,
                          commodity: enterprises[0]?.sector ?? 'Produce',
                          priceKes: priceKes.trim()
                        });
                        setPriceKes('');
                        setNotes(await FarmerAppService.listFarmerMarketNotes());
                        await refresh();
                      } finally {
                        setSavingPrice(false);
                      }
                    })();
                  }}
                />
              </View>
              {linkage.notes.map((note) => (
                <Caption key={note.id} style={{ marginTop: spacing.sm }}>
                  You noted {note.commodity} at {note.priceKes} KES / {note.unit} · {note.marketName}
                </Caption>
              ))}
            </Card>
          ) : null}
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
                  {priceHonesty(item.dataStatus, item.updatedAt)} · {item.sourceLabel ?? 'Ministry of Agriculture (KAMIS)'} · {freshnessLabel(item.updatedAt)}
                </Caption>
              </Card>
            );
          }) : linkage.nearest.length ? null : <EmptyState title="Market price unavailable" body="We only show prices when a source exists for your enterprises." />}
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
  if (kind === 'weather') return 'Forecast for the farm place — not the phone. Forecasts can change.';
  if (kind === 'markets') return 'Produce prices near the farm place — maize, milk, tomato, beans and more when the Ministry has reported them. We never invent a price.';
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
