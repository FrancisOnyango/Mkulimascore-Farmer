import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Caption, H1 } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import { HomeSkeleton } from '@/components/Skeleton';
import { VerificationStatus } from '@/components/VerificationStatus';
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
          <EmptyState title="Your farm data is unavailable" body={refreshError} action="Try again" onAction={() => void refresh()} />
        ) : <HomeSkeleton />}
      </AppShell>
    );
  }

  const primaryFarm = farms[0];
  const farmEnterprises = primaryFarm ? enterprises.filter((enterprise) => enterprise.farmId === primaryFarm.id) : enterprises;
  const firstEnterprise = farmEnterprises[0];
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
  const enterpriseNames = farmEnterprises.length ? farmEnterprises.map((enterprise) => enterprise.sector).join(' · ') : 'Add an enterprise';
  const place = [primaryFarm?.location || passport.location, enterpriseNames].filter(Boolean).join(' · ');

  return (
    <AppShell>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Caption>{greeting()}</Caption>
          <H1>{firstName(passport.displayName) || 'Farmer'}</H1>
          <Caption style={styles.place}>{place || 'Your farm'}</Caption>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel="Open notifications" style={styles.notificationButton}>
          <Text style={styles.notificationCount}>{notifications.filter((item) => !item.read).length || '·'}</Text>
        </Pressable>
      </View>

      <FarmerSection title="What matters today" detail={modules.length ? undefined : 'Nothing urgent from your saved farm context.'}>
        {modules.length ? modules.map((module, index) => (
          <FarmerRow
            key={module.id}
            value={module.title}
            label={module.detail}
            status={module.status}
            tone={module.attention ? 'attention' : 'neutral'}
            onPress={module.route ? () => router.push(module.route as never) : undefined}
            last={index === modules.length - 1}
          />
        )) : (
          <FarmerRow value="You are up to date" label="Weather, records and requests will appear here when they matter." last />
        )}
      </FarmerSection>

      {primaryFarm ? (
        <FarmerSection title="My farm" action="Open" onAction={() => router.push('/(tabs)/farm')}>
          <FarmerRow
            value={primaryFarm.name}
            label={`${primaryFarm.reportedArea || primaryFarm.measuredArea || 'Area not set'} ${primaryFarm.areaUnit}`}
            detail={primaryFarm.mapped ? 'Farm location is on the map.' : 'Detailed boundary not yet mapped.'}
            onPress={() => router.push(`/farm/${primaryFarm.id}`)}
            last={!firstEnterprise}
          />
          {firstEnterprise ? (
            <FarmerRow
              value={firstEnterprise.sector}
              label={firstEnterprise.productionValue}
              detail={firstEnterprise.summary}
              onPress={() => router.push(`/enterprise/${firstEnterprise.id}`)}
              last
            />
          ) : null}
        </FarmerSection>
      ) : (
        <FarmerSection title="My farm">
          <FarmerRow value="Add your farm" label="A location is enough to start." onPress={() => router.push('/(tabs)/farm')} last />
        </FarmerSection>
      )}

      <View style={styles.note}>
        <VerificationStatus state="reported" />
        <Caption style={{ marginTop: spacing.xs }}>Records you add stay marked as added by you until a visit or cooperative confirms them.</Caption>
      </View>
    </AppShell>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string) {
  return name.split(' ')[0] || name;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xl },
  place: { marginTop: spacing.xs },
  notificationButton: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  notificationCount: { color: colors.brandDark, fontSize: 16, fontWeight: '800' },
  note: { marginTop: spacing.xxl }
});
