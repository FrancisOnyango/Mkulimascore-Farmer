import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { AskBar } from '@/components/AskBar';
import { Caption, H1, H3 } from '@/components/Typography';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, shadow, spacing } from '@/constants/theme';

const sections = [
  { title: 'For my farm', detail: 'Health, season and the living farm profile', route: '/(tabs)/farm' },
  { title: 'Weather & early warning', detail: 'Forecast, preparedness watches and seasonal outlook', route: '/insights/weather' },
  { title: 'Markets', detail: 'Nearby options, when a source exists', route: '/insights/markets' },
  { title: 'My profile', detail: 'What can strengthen the Passport', route: '/passport' }
] as const;

export default function Insights() {
  const { farms, selectedFarmId, setSelectedFarmId } = useAppData();
  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? farms[0];

  return (
    <AppShell ask={{ screen: 'insights' }}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Intelligence layer</Text>
        <H1 style={styles.heroTitle}>Insights</H1>
        <Caption style={styles.heroCopy}>Weather, early warning, markets and profile - from the farm, not a dashboard.</Caption>
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <AskBar hint="Weather, prices or why the profile needs work" onPress={() => router.push({ pathname: '/ask', params: { screen: 'insights' } })} />
      </View>

      {farms.length > 1 ? (
        <View style={styles.switcher}>
          {farms.map((farm) => (
            <Pressable
              key={farm.id}
              onPress={() => setSelectedFarmId(farm.id)}
              style={[styles.farmChip, farm.id === selectedFarm?.id && styles.farmChipActive]}
            >
              <Text style={[styles.farmChipText, farm.id === selectedFarm?.id && styles.farmChipTextActive]}>{farm.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        {sections.map((section) => (
          <Pressable key={section.title} onPress={() => router.push(section.route as never)} style={styles.row} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <H3>{section.title}</H3>
              <Caption style={{ marginTop: 4 }}>{section.detail}</Caption>
            </View>
            <Text style={styles.link}>Open</Text>
          </Pressable>
        ))}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.midnight, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', ...shadow.lift },
  heroKicker: { color: '#95A3EC', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs },
  heroTitle: { color: '#fff' },
  heroCopy: { color: '#DADAF0', marginTop: spacing.sm },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  farmChip: { minHeight: 38, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceGlass, justifyContent: 'center', paddingHorizontal: spacing.md },
  farmChipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  farmChipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  farmChipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  link: { color: colors.info, fontWeight: '800' }
});
