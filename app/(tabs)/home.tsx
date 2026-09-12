import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { HomeSkeleton } from '@/components/Skeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { buildTodayBrief } from '@/lib/intelligence/today';
import { colors, radius, spacing } from '@/constants/theme';

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
    selectedFarmId,
    setSelectedFarmId,
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

  const farm = farms.find((item) => item.id === selectedFarmId) ?? farms[0];
  const farmEnterprises = farm ? enterprises.filter((item) => item.farmId === farm.id) : enterprises;
  const farmWeather = weather.find((item) => item.farmId === farm?.id) ?? (farm ? undefined : weather[0]);
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
  const unread = notifications.filter((item) => !item.read).length;
  const farmRoute = farm ? `/farm/${farm.id}` : '/(tabs)/farm';

  return (
    <AppShell>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{brief.hello}, {brief.firstName}</Text>
          <Text style={styles.place}>{brief.placeLine || 'Your farm'}</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bell}>
          <Text style={styles.bellText}>{unread || '·'}</Text>
        </Pressable>
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

      {brief.lines.length ? (
        <Pressable onPress={() => router.push(farmRoute as never)} style={styles.today} accessibilityRole="button">
          <Text style={styles.todayKicker}>Today on your farm</Text>
          {brief.lines.map((line) => (
            <Text key={line.id} style={line.kind === 'weather' || line.kind === 'cycle' ? styles.lead : styles.line}>{line.text}</Text>
          ))}
          <Text style={styles.todayLink}>View farm</Text>
        </Pressable>
      ) : null}

      {brief.nextAction ? (
        <View style={styles.block}>
          <Text style={styles.kicker}>Do this next</Text>
          <Text style={styles.title}>{brief.nextAction.title}</Text>
          <Text style={styles.body}>{brief.nextAction.why}</Text>
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label={brief.nextAction.cta} onPress={() => router.push(brief.nextAction!.route as never)} />
          </View>
        </View>
      ) : null}

      {brief.recent.length ? (
        <View style={styles.recent}>
          <Text style={styles.kicker}>Recent</Text>
          {brief.recent.map((item) => (
            <Text key={item.id} style={styles.recentItem}>✓ {item.title}</Text>
          ))}
        </View>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  hello: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  place: { color: colors.muted, fontSize: 15, marginTop: 4, fontWeight: '600' },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  bellText: { color: '#fff', fontWeight: '800' },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  farmChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  farmChipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  farmChipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  farmChipTextOn: { color: '#fff' },
  today: { backgroundColor: colors.brandDark, borderRadius: 20, padding: spacing.lg, marginBottom: spacing.lg },
  todayKicker: { color: '#C9E6D1', fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  todayLink: { color: '#9FD0B0', fontWeight: '800', marginTop: spacing.md },
  lead: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: spacing.sm },
  line: { color: '#D8E8DE', fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  kicker: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  block: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: spacing.xs },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 4 },
  recent: { marginTop: spacing.sm, marginBottom: spacing.xl },
  recentItem: { color: colors.text, fontSize: 14, marginTop: spacing.sm }
});
