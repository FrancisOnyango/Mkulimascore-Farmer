import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { InsightCard } from '@/components/InsightCard';
import { EmptyState } from '@/components/EmptyState';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, spacing } from '@/constants/theme';

const flagshipCategories = [
  { kind: 'weather', title: 'Weather', detail: 'Rain and field days' },
  { kind: 'markets', title: 'Market', detail: 'When a source exists' },
  { kind: 'enterprise', title: 'Farm', detail: 'Your crops and animals' },
  { kind: 'financial', title: 'Readiness', detail: 'If you choose to share' }
] as const;

export default function Insights() {
  const { farms, insights, weather, markets, alerts, selectedFarmId, setSelectedFarmId } = useAppData();
  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? farms[0];
  const primaryWeather = weather.find((item) => item.farmId === selectedFarm?.id) ?? weather[0];
  const primaryMarket = markets[0];
  const opportunities = getInsightOpportunities({ farms, insights, alerts });
  return (
    <AppShell>
      <H1>Today</H1>

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

      {primaryWeather ? (
        <Card style={styles.recommendationCard} onPress={() => router.push('/insights/weather')}>
          <Caption style={styles.recommendationLabel}>Today</Caption>
          <H3 style={{ marginTop: spacing.xs }}>{primaryWeather.condition}</H3>
          <Body style={{ marginTop: spacing.sm }}>{primaryWeather.fieldActivityNote}</Body>
        </Card>
      ) : null}

      {primaryMarket && primaryMarket.dataStatus !== 'unavailable' ? (
        <Card style={{ marginTop: spacing.md }} onPress={() => router.push('/insights/markets')}>
          <Caption>Market</Caption>
          <H3 style={{ marginTop: spacing.xs }}>{primaryMarket.commodity}</H3>
          <Body style={{ marginTop: spacing.sm }}>{primaryMarket.localRange ?? primaryMarket.observedPrice}</Body>
          <Caption style={{ marginTop: spacing.sm }}>{[primaryMarket.sourceLabel, primaryMarket.dataStatus].filter(Boolean).join(' · ')}</Caption>
        </Card>
      ) : null}

      <Card style={styles.opportunityCard}>
        <View style={styles.opportunityHeader}>
          <View style={{ flex: 1 }}>
            <Caption>Next</Caption>
            <H3 style={{ marginTop: spacing.xs }}>For your farm</H3>
          </View>
          <Text style={styles.opportunityBadge}>{opportunities.length}</Text>
        </View>
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {opportunities.map((opportunity) => (
            <Pressable key={opportunity.title} onPress={() => router.push(opportunity.route as never)} style={styles.opportunityRow}>
              <View style={{ flex: 1 }}>
                <Body style={styles.opportunityTitle}>{opportunity.title}</Body>
                <Caption>{opportunity.detail}</Caption>
              </View>
              <Text style={styles.link}>Open</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <View style={styles.grid}>
        {flagshipCategories.map((category) => (
          <Pressable key={category.kind} onPress={() => router.push(`/insights/${category.kind}`)} style={({ pressed }) => [styles.category, pressed && { opacity: 0.86 }]}>
            <View style={styles.categoryRail} />
            <H3>{category.title}</H3>
            <Caption style={{ marginTop: spacing.sm }}>{category.detail}</Caption>
            <Text style={styles.link}>Explore</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
        {insights.length ? insights.map((insight) => <InsightCard key={insight.id} insight={insight} />) : (
          <EmptyState title="Add a farm first" body="Weather and market appear when we have them." action="Farm" onAction={() => router.push('/(tabs)/farm')} />
        )}
      </View>

      <Pressable onPress={() => router.push('/ask')} accessibilityRole="button" style={styles.askLink}>
        <Text style={styles.askText}>Ask Mkulima</Text>
      </Pressable>
    </AppShell>
  );
}

function getInsightOpportunities({
  farms,
  insights,
  alerts
}: {
  farms: { id: string; mapped: boolean; name: string }[];
  insights: { title: string; kind: string; tone: string }[];
  alerts: { category: string; title: string; detail: string; deepLink?: string }[];
}) {
  const opportunities: { title: string; detail: string; route: string }[] = [];
  const attention = insights.find((insight) => insight.tone === 'attention');
  const unmapped = farms.find((farm) => !farm.mapped);
  if (attention) opportunities.push({ title: attention.title, detail: 'Saved for this farm.', route: `/insights/${attention.kind}` });
  if (unmapped) opportunities.push({ title: `Place for ${unmapped.name}`, detail: 'A village name is enough.', route: `/farm/${unmapped.id}` });
  const alert = alerts.find((item) => item.category === 'evidence');
    if (alert && opportunities.length < 3) opportunities.push({ title: alert.title, detail: alert.detail, route: alert.deepLink ?? '/records' });
  return opportunities.slice(0, 3);
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  farmChip: { minHeight: 38, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  farmChipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  farmChipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  farmChipTextActive: { color: '#fff' },
  hero: { marginTop: spacing.xl, backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  heroCaption: { color: '#D8E8DE' },
  heroTitle: { color: '#fff', marginTop: spacing.xs },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  mini: { width: '48%', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: radius.md, padding: spacing.sm },
  miniValue: { color: '#fff', fontWeight: '900', marginTop: 2, fontSize: 12, lineHeight: 16 },
  recommendationCard: { marginTop: spacing.md, backgroundColor: colors.brandSoft, borderColor: '#C9E0D1' },
  recommendationLabel: { color: colors.brand },
  opportunityCard: { marginTop: spacing.md, backgroundColor: colors.surfaceAlt },
  opportunityHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  opportunityBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandDark, color: '#fff', textAlign: 'center', lineHeight: 30, fontWeight: '900' },
  opportunityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  opportunityTitle: { fontWeight: '800', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xxl },
  category: { width: '47%', minHeight: 150, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, overflow: 'hidden' },
  categoryRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.info },
  supportGrid: { gap: spacing.md, marginTop: spacing.md },
  supportCard: { minHeight: 82, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  link: { color: colors.info, fontWeight: '800', marginTop: 'auto' },
  askLink: { marginTop: spacing.xl, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brandDark, justifyContent: 'center', alignItems: 'center' },
  askText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});
