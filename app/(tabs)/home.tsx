import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Caption } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import { HomeSkeleton } from '@/components/Skeleton';
import { ActionTile } from '@/components/ActionTile';
import { AskBar } from '@/components/AskBar';
import { useAppData } from '@/context/AppDataContext';
import { buildHomeModules } from '@/lib/home/modules';
import { colors, radius, spacing } from '@/constants/theme';

export default function Home() {
  const {
    ready,
    passport,
    farms,
    enterprises,
    requests,
    outbox,
    notifications,
    weather,
    markets,
    alerts,
    consents,
    activity,
    refresh,
    refreshError
  } = useAppData();

  if (!ready || !passport) {
    return (
      <AppShell>
        {refreshError ? (
          <EmptyState title="Could not load" body={refreshError} action="Try again" onAction={() => void refresh()} />
        ) : <HomeSkeleton />}
      </AppShell>
    );
  }

  const primaryFarm = farms[0];
  const farmEnterprises = primaryFarm ? enterprises.filter((enterprise) => enterprise.farmId === primaryFarm.id) : enterprises;
  const pending = outbox.filter((item) => item.state !== 'SYNCED').length;
  const todayWeather = weather.find((item) => item.farmId === primaryFarm?.id) ?? weather[0];
  const modules = buildHomeModules({
    passport,
    farm: primaryFarm,
    enterprises: farmEnterprises,
    weather: todayWeather,
    markets,
    alerts,
    requests,
    outbox,
    consents,
    pendingCount: pending,
    latestActivity: activity[0] ? { title: activity[0].title, detail: activity[0].detail } : undefined
  });
  const unread = notifications.filter((item) => !item.read).length;
  const focus = modules[0];

  return (
    <AppShell>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{greeting()}, {firstName(passport.displayName) || 'farmer'}</Text>
            <Text style={styles.place}>{primaryFarm?.location || passport.location || 'Your farm'}</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bell}>
            <Text style={styles.bellText}>{unread || '·'}</Text>
          </Pressable>
        </View>
        {todayWeather ? (
          <Pressable onPress={() => router.push('/insights/weather')} accessibilityRole="button" style={styles.weather}>
            <Text style={styles.weatherTitle}>{todayWeather.condition}</Text>
            <Text style={styles.weatherMeta}>{todayWeather.rainProbabilityPct}% rain</Text>
          </Pressable>
        ) : null}
      </View>

      {farmEnterprises.length ? (
        <View style={styles.chips}>
          {farmEnterprises.map((enterprise) => (
            <Pressable
              key={enterprise.id}
              onPress={() => router.push(`/enterprise/${enterprise.id}`)}
              accessibilityRole="button"
              accessibilityLabel={enterprise.sector}
              style={styles.chip}
            >
              <Text style={styles.chipSector}>{enterprise.sector}</Text>
              <Text style={styles.chipValue}>{enterprise.productionValue}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable onPress={() => router.push('/(tabs)/farm')} style={styles.emptyFarm}>
          <Text style={styles.emptyFarmTitle}>Add what you grow</Text>
          <Text style={styles.emptyFarmBody}>Dairy, maize, tea, poultry — tap to start.</Text>
        </Pressable>
      )}

      {focus ? (
        <Pressable
          onPress={focus.route ? () => router.push(focus.route as never) : undefined}
          accessibilityRole={focus.route ? 'button' : undefined}
          style={[styles.focus, focus.attention && styles.focusAlert]}
        >
          <Caption style={styles.focusLabel}>{focus.attention ? 'Needs you' : 'Today'}</Caption>
          <Text style={styles.focusTitle}>{focus.title}</Text>
          <Text style={styles.focusDetail}>{focus.detail}</Text>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        <ActionTile icon="add" label="Add" tone="dark" onPress={() => router.push('/add')} />
        <ActionTile icon="leaf-outline" label="Farm" onPress={() => router.push('/(tabs)/farm')} />
        <ActionTile icon="sunny-outline" label="Weather" onPress={() => router.push('/insights/weather')} />
        <ActionTile icon="document-text-outline" label="Records" onPress={() => router.push('/records')} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AskBar onPress={() => router.push('/ask')} />
      </View>
    </AppShell>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function firstName(name: string) {
  return name.split(' ')[0] || name;
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brandDark,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  hello: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '800' },
  place: { color: '#C9E6D1', fontSize: 14, marginTop: 4, fontWeight: '600' },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  bellText: { color: '#fff', fontWeight: '800' },
  weather: { marginTop: spacing.lg, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: spacing.md },
  weatherTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  weatherMeta: { color: '#D7E8DC', marginTop: 2, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { minWidth: 120, flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  chipSector: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  chipValue: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 4 },
  emptyFarm: { backgroundColor: colors.brandSoft, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  emptyFarmTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyFarmBody: { color: colors.muted, marginTop: 4 },
  focus: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  focusAlert: { backgroundColor: colors.warm, borderColor: '#E7D7AE' },
  focusLabel: { color: colors.brand, fontWeight: '800' },
  focusTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: spacing.xs },
  focusDetail: { color: colors.muted, marginTop: 4, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }
});
