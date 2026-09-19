import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { HomeSkeleton } from '@/components/Skeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { BrandMark } from '@/components/BrandMark';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { AlertCard } from '@/components/AlertCard';
import { useAppData } from '@/context/AppDataContext';
import { buildTodayBrief } from '@/lib/intelligence/today';
import { buildHomeCards } from '@/lib/intelligence/homeCards';
import { loadFarmEarlyWarnings } from '@/lib/warnings/load';
import { FarmerAppService } from '@/application/FarmerAppService';
import type { FarmerAlert } from '@/domain/warnings';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import { weatherFreshnessLabel } from '@/lib/weather/liveWeather';

export default function Home() {
  const {
    ready,
    passport,
    farms,
    enterprises,
    records,
    consents,
    notifications,
    weather,
    climate,
    markets,
    activity,
    requests,
    alerts,
    selectedFarmId,
    setSelectedFarmId,
    refresh,
    refreshError,
    settings
  } = useAppData();
  const { screenPad, narrow } = useMobileLayout();
  const [earlyWarnings, setEarlyWarnings] = useState<FarmerAlert[]>([]);

  const farm = useMemo(
    () => farms.find((item) => item.id === selectedFarmId) ?? farms[0],
    [farms, selectedFarmId]
  );
  const farmEnterprises = useMemo(
    () => farm ? enterprises.filter((item) => item.farmId === farm.id) : enterprises,
    [enterprises, farm]
  );
  const farmWeather = useMemo(
    () => weather.find((item) => item.farmId === farm?.id) ?? (farm ? undefined : weather[0]),
    [farm, weather]
  );

  useEffect(() => {
    if (!ready || !farm) {
      return;
    }
    let cancelled = false;
    void loadFarmEarlyWarnings({
      farm,
      enterprises: farmEnterprises,
      weather: farmWeather,
      language: settings.language
    }).then((items) => {
      if (!cancelled) setEarlyWarnings(items);
    });
    return () => { cancelled = true; };
  }, [ready, farm, farmWeather, farmEnterprises, settings.language]);

  if (!ready || !passport) {
    return (
      <AppShell>
        {refreshError ? (
          <EmptyState title="Could not load" body={refreshError} action="Try again" onAction={() => void refresh()} />
        ) : <HomeSkeleton />}
      </AppShell>
    );
  }

  const brief = buildTodayBrief({
    passport,
    farm,
    farms,
    enterprises: farmEnterprises,
    records,
    consents,
    weather: farmWeather,
    climate,
    markets,
    activity
  });
  const home = buildHomeCards({
    passport,
    farm,
    farms,
    enterprises: farmEnterprises,
    records,
    consents,
    requests,
    alerts,
    earlyWarnings: farm ? earlyWarnings.filter((item) => item.farmId === farm.id) : [],
    weather: farmWeather,
    activityTitles: activity.slice(0, 2).map((item) => item.title)
  });
  const unread = notifications.filter((item) => !item.read).length;
  const farmRoute = farm ? `/farm/${farm.id}` : '/(tabs)/farm';
  const headline = brief.lines[0];
  const rest = brief.lines.slice(1);
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });
  const health = brief.twin.health;
  const mapped = Boolean(farm?.mapped && farm.boundary && farm.boundary.length >= 3);
  const nextAction = home.primaryAction ?? brief.nextAction;
  const weatherWindow = home.weatherWindows[0];
  const topWarning = home.topWarning;

  async function ackWarning(alert: FarmerAlert) {
    await FarmerAppService.acknowledgeWarning(alert.id, alert.actions[0]?.id);
    const next = await loadFarmEarlyWarnings({
      farm,
      enterprises: farmEnterprises,
      weather: farmWeather,
      language: settings.language
    });
    setEarlyWarnings(next);
    await refresh();
  }

  return (
    <AppShell>
      <View style={[styles.heroWash, { marginHorizontal: -screenPad, paddingHorizontal: screenPad }]}>
        <View style={styles.top}>
          <BrandMark size={narrow ? 38 : 44} light />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.overline}>Mkulima daily overview</Text>
            <Text style={[styles.hello, narrow && styles.helloNarrow]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
              {brief.hello}, {brief.firstName}
            </Text>
            <Text style={styles.place} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{brief.placeLine || 'Your farm'}</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bell}>
            <Text style={styles.bellText}>{unread || '·'}</Text>
          </Pressable>
        </View>
      </View>

      {farms.length > 1 ? (
        <View style={styles.switcher}>
          {farms.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedFarmId(item.id)}
              style={[styles.farmChip, item.id === farm?.id && styles.farmChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: item.id === farm?.id }}
            >
              <Text style={[styles.farmChipText, item.id === farm?.id && styles.farmChipTextOn]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {farm?.latitude != null && farm.longitude != null ? (
        <Pressable onPress={() => router.push((mapped ? farmRoute : '/farm/map') as never)} accessibilityRole="button" accessibilityLabel="Open farm map" style={styles.mapWrap}>
          <FarmPlaceMap farm={farm} height={narrow ? 132 : 148} interactive={false} showZoom={false} basemap="satellite" />
          <Text style={styles.mapHint}>{mapped ? 'Your farm · tap to open' : 'Place marked · walk the edge when you are there'}</Text>
        </Pressable>
      ) : null}

      {topWarning ? (
        <View style={styles.warningSlot}>
          <Text style={styles.kicker}>Needs attention now</Text>
          <AlertCard
            alert={topWarning}
            onOpen={() => router.push(`/warnings/${encodeURIComponent(topWarning.id)}?farmId=${topWarning.farmId}` as never)}
            onAck={() => void ackWarning(topWarning)}
          />
        </View>
      ) : null}

      {headline ? (
        <Pressable onPress={() => router.push(farmRoute as never)} style={styles.today} accessibilityRole="button">
          <View style={styles.todayTop}>
            <Text style={styles.todayKicker}>Today on your farm</Text>
            <View style={[styles.pill, health.level === 'attention' && styles.pillHot, health.level === 'watch' && styles.pillWarm]}>
              <Text style={styles.pillText} numberOfLines={1}>{health.label}</Text>
            </View>
          </View>
          <Text style={[styles.lead, narrow && styles.leadNarrow]}>{headline.text}</Text>
          {weatherWindow ? <Text style={styles.weatherLine}>{weatherWindow.line}</Text> : null}
          {rest.map((line) => (
            <View key={line.id} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.line}>{line.text}</Text>
            </View>
          ))}
          <Text style={styles.todayLink}>{farm ? 'Open this farm' : 'Add a farm'}</Text>
        </Pressable>
      ) : null}

      {farmWeather ? (
        <Pressable onPress={() => router.push('/insights/weather')} style={styles.weatherPanel} accessibilityRole="button">
          <Text style={styles.weatherPanelKicker}>Farm weather</Text>
          <Text style={styles.freshness}>{weatherFreshnessLabel(farmWeather)}</Text>
          <View style={styles.metricRow}>
            <MetricChip label="Rain" value={`${farmWeather.rainProbabilityPct}%`} tone="water" />
            <MetricChip label="Temp" value={`${farmWeather.temperatureHighC}°`} tone="warm" />
            <MetricChip label="Sky" value={farmWeather.condition.split(' ')[0] ?? farmWeather.condition} tone="green" />
          </View>
          <Text style={styles.disclaimer}>{farmWeather.sourceDisclaimer ?? 'Model forecast lane — not an official warning.'}</Text>
          <Text style={styles.link}>Forecast & preparedness</Text>
        </Pressable>
      ) : null}

      {home.cards.filter((card) => card.kind === 'request').map((card) => (
        <Pressable
          key={card.id}
          onPress={() => router.push(('route' in card ? card.route : farmRoute) as never)}
          style={styles.block}
          accessibilityRole="button"
        >
          <Text style={styles.kicker}>Institution request</Text>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.body}>{card.body}</Text>
          {'cta' in card ? <Text style={styles.link}>{card.cta}</Text> : null}
        </Pressable>
      ))}

      {nextAction ? (
        <View style={styles.block}>
          <Text style={styles.kicker}>If you have a minute</Text>
          <Text style={styles.title}>{nextAction.title}</Text>
          <Text style={styles.body}>{nextAction.why}</Text>
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label={nextAction.cta} onPress={() => router.push(nextAction.route as never)} />
          </View>
        </View>
      ) : null}

      {brief.twin.market?.priceLabel ? (
        <Pressable onPress={() => router.push('/insights/markets')} style={styles.block} accessibilityRole="button">
          <Text style={styles.kicker}>Market near you</Text>
          <Text style={styles.title}>{brief.twin.market.name}</Text>
          <Text style={styles.body}>
            {brief.twin.market.distanceLabel}
            {brief.twin.market.commodity ? ` · ${brief.twin.market.commodity}` : ''}
            {` · ${brief.twin.market.priceLabel}. ${brief.twin.market.freshnessLabel}.`}
          </Text>
          <Text style={styles.link}>View markets</Text>
        </Pressable>
      ) : null}

      {brief.recent.length ? (
        <View style={styles.recent}>
          <Text style={styles.kicker}>Recent</Text>
          {brief.recent.map((item) => (
            <Text key={item.id} style={styles.recentItem}>✓  {item.title}</Text>
          ))}
        </View>
      ) : null}
    </AppShell>
  );
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone: 'water' | 'warm' | 'green' }) {
  const bg = tone === 'water' ? colors.waterSoft : tone === 'warm' ? colors.warm : colors.brandSoft;
  const fg = tone === 'water' ? colors.water : tone === 'warm' ? colors.warmInk : colors.brandDark;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.chipValue, { color: colors.ink }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWash: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.midnight,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  overline: { color: '#95A3EC', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  hello: { color: '#fff', fontSize: 25, lineHeight: 31, fontWeight: '800' },
  helloNarrow: { fontSize: 21, lineHeight: 26 },
  place: { color: '#DADAF0', fontSize: 14, marginTop: 2, fontWeight: '700' },
  date: { color: '#95A3EC', fontSize: 12, marginTop: 2, fontWeight: '600' },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bellText: { color: '#fff', fontWeight: '800' },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  farmChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceGlass, justifyContent: 'center', paddingHorizontal: spacing.md },
  farmChipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  farmChipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  farmChipTextOn: { color: '#fff' },
  mapWrap: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md, ...shadow.card },
  mapHint: { color: colors.faint, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: spacing.sm },
  warningSlot: { marginBottom: spacing.sm },
  today: { backgroundColor: colors.midnight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', ...shadow.lift },
  todayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  todayKicker: { flexShrink: 1, color: '#C9E6D1', fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  pill: { maxWidth: '46%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillWarm: { backgroundColor: 'rgba(243,228,192,0.22)' },
  pillHot: { backgroundColor: 'rgba(166,84,63,0.35)' },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  todayLink: { color: '#95A3EC', fontWeight: '800', marginTop: spacing.md },
  lead: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: spacing.md },
  leadNarrow: { fontSize: 18, lineHeight: 24 },
  weatherLine: { color: '#D8E8DE', fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#95A3EC', marginTop: 8 },
  line: { flex: 1, color: '#D8E8DE', fontSize: 14, lineHeight: 21 },
  kicker: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: spacing.sm },
  weatherPanel: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card
  },
  weatherPanelKicker: { color: colors.water, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  freshness: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  disclaimer: { color: colors.faint, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  metricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chip: { flex: 1, minWidth: 0, borderRadius: radius.md, padding: spacing.md, minHeight: 58, justifyContent: 'space-between' },
  chipLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  chipValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  block: { backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: spacing.xs },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  recent: { marginTop: spacing.sm, marginBottom: spacing.lg },
  recentItem: { color: colors.text, fontSize: 14, marginTop: spacing.sm },
  link: { color: colors.brandDark, fontWeight: '800', marginTop: spacing.md }
});
