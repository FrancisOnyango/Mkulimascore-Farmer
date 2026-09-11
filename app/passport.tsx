import React from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { DataRow } from '@/components/DataRow';
import { StatusPill } from '@/components/StatusPill';
import { useAppData } from '@/context/AppDataContext';
import { colors, spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { formatDate } from '@/lib/utils/format';

export default function PassportScreen() {
  const { passport, farms, enterprises, consents, financing } = useAppData();
  if (!passport) return <AppShell><Body>Loading passport...</Body></AppShell>;
  const activeConsents = consents.filter((consent) => consent.status === 'active');
  const readinessItems = [
    { label: 'Identity', complete: Boolean(passport.displayName), next: 'Add your name' },
    { label: 'Farm', complete: farms.length > 0, next: 'Add a farm' },
    { label: 'Enterprises', complete: enterprises.length > 0, next: 'Add an enterprise' },
    { label: 'Records', complete: passport.evidenceStatus.toLowerCase() !== 'none' && passport.evidenceStatus !== 'No records yet', next: 'Add a production record' },
    { label: 'Institution', complete: consents.length > 0 || passport.affiliations.length > 0, next: 'Connect a cooperative' }
  ];
  const strength = readinessItems.filter((item) => item.complete).length >= 4 ? 'Strong farm profile' : readinessItems.filter((item) => item.complete).length >= 2 ? 'Good progress' : 'Just getting started';
  const improve = readinessItems.filter((item) => !item.complete).map((item) => item.next);

  return (
    <AppShell>
      <Eyebrow>Mkulima Passport</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{passport.displayName || 'Your Passport'}</H2>
      <Caption>{passport.location || 'Location can be added later'}</Caption>

      <Card style={styles.hero}>
        <View style={styles.heroRail} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Caption style={styles.heroCaption}>Identity</Caption>
            <H3 style={styles.heroText}>{passport.identityVerified ? 'Verified identity' : 'Needs verification'}</H3>
            <Caption style={styles.heroCaption}>{passport.evidenceStatus}</Caption>
          </View>
          <StatusPill label={strength} tone={improve.length ? 'attention' : 'verified'} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <DataRow label="Phone" value={passport.phoneMasked} />
        <DataRow label="Location" value={passport.location} />
        <DataRow label="Evidence" value={passport.evidenceStatus} />
        <DataRow label="Freshness" value={passport.recordFreshness} />
        <DataRow label="Last updated" value={formatDate(passport.lastUpdated)} last />
      </Card>
      <Card style={styles.trustCard}>
        <H3>Keep your farm profile current</H3>
        <Body style={{ marginTop: spacing.sm }}>Recent production, sales, costs, and evidence make this view more useful when you choose to share it.</Body>
        <View style={styles.trustActions}>
          <StatusPill label={`${activeConsents.length} active permission${activeConsents.length === 1 ? '' : 's'}`} tone="verified" />
          <Body style={styles.trustLink} onPress={() => router.push('/consents')}>Review permissions</Body>
        </View>
      </Card>
      <Card style={{ marginTop: spacing.md }}>
        <Caption>Profile status</Caption>
        <H3 style={{ marginTop: spacing.xs }}>{strength}</H3>
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {readinessItems.map((item) => (
            <View key={item.label} style={styles.checkRow}>
              <Text style={[styles.check, item.complete && styles.checkComplete]}>{item.complete ? 'Yes' : '—'}</Text>
              <Body>{item.complete ? item.label : item.next}</Body>
            </View>
          ))}
        </View>
      </Card>

      <Section title="Affiliations" values={passport.affiliations} />
      <Section title="Farms" values={farms.map((farm) => `${farm.name} - ${farm.location}`)} />
      <Section title="Enterprises" values={enterprises.map((enterprise) => `${enterprise.sector} - ${enterprise.productionValue}`)} />
      <Section title="Permitted financing information" values={financing.map((item) => `${item.institution} - ${item.purpose}`)} />
      <Section title="Active permissions" values={activeConsents.map((item) => `${item.institution}: ${item.scopes.join(', ')}`)} />

      <Caption style={styles.note}>{strings.disclaimer}</Caption>
    </AppShell>
  );
}

function Section({ title, values }: { title: string; values: string[] }) {
  return (
    <Card style={{ marginTop: spacing.md }}>
      <H3>{title}</H3>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {values.length ? values.map((value) => (
          <View key={value} style={styles.listRow}>
            <View style={styles.dot} />
            <Body style={{ flex: 1 }}>{value}</Body>
          </View>
        )) : <Caption>None currently shown.</Caption>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.xl, backgroundColor: colors.brandDark, borderColor: colors.brandDark, overflow: 'hidden' },
  heroRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colors.info },
  heroCaption: { color: '#D8E8DE' },
  heroText: { color: '#fff', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  listRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 },
  note: { marginTop: spacing.xxl, textAlign: 'center' },
  trustCard: { marginTop: spacing.md, backgroundColor: colors.surfaceAlt },
  trustActions: { marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  trustLink: { color: colors.info, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden', marginTop: spacing.lg },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { width: 22, color: colors.muted, fontWeight: '900' },
  checkComplete: { color: colors.success }
});
