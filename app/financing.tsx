import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ReadinessChecklist, type ReadinessItem } from '@/components/ReadinessChecklist';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState } from '@/components/EmptyState';
import { useAppData } from '@/context/AppDataContext';
import type { FinancingFacility } from '@/domain/types';
import { colors, spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { formatDate, formatKes } from '@/lib/utils/format';

const statusLabel: Record<FinancingFacility['status'], string> = {
  submitted: 'Submitted',
  institution_review: 'With the institution',
  approved: 'Approved',
  declined: 'Declined',
  disbursed: 'Disbursed',
  active: 'Active',
  repaid: 'Repaid',
  restructured: 'Restructured'
};

export default function Financing() {
  const { passport, farms, enterprises, records, consents, financing } = useAppData();
  const checklist: ReadinessItem[] = [
    { label: 'Identity', detail: passport?.displayName ? 'Your name is on the Passport.' : 'Add your name.', state: passport?.displayName ? 'complete' : 'attention' },
    { label: 'Farm', detail: farms[0] ? farms[0].name : 'Add a farm location.', state: farms.length ? 'complete' : 'attention' },
    { label: 'Enterprise', detail: enterprises[0] ? enterprises.map((item) => item.sector).join(' · ') : 'Add what you farm.', state: enterprises.length ? 'complete' : 'attention' },
    { label: 'Recent record', detail: records.length ? 'You have saved farm records.' : 'Add a production or sales record.', state: records.length ? 'complete' : 'attention' },
    { label: 'Institution', detail: consents.length ? 'A connection exists or is pending.' : 'Connect a SACCO or cooperative if you have one.', state: consents.length ? 'complete' : 'attention' }
  ];

  return (
    <AppShell>
      <H2>Farm financial profile</H2>
      <Body style={styles.lead}>{strings.disclaimer}</Body>

      <Card style={styles.stateCard}>
        <Caption>Profile status</Caption>
        <H3 style={{ marginTop: spacing.sm }}>{passport?.readinessLabel ?? 'Just getting started'}</H3>
        <Body style={{ marginTop: spacing.sm }}>This does not mean a loan will be approved. Institutions decide after you choose to share.</Body>
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <ReadinessChecklist title="What is in place" items={checklist.filter((item) => item.state === 'complete')} />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <ReadinessChecklist title="What can make it stronger" items={checklist.filter((item) => item.state !== 'complete')} />
      </View>

      <H3 style={{ marginTop: spacing.xxl }}>From participating institutions</H3>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {financing.length ? financing.map((item) => (
          <Card key={item.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <H3>{item.institution}</H3>
                <Caption style={{ marginTop: spacing.xs }}>{item.purpose}</Caption>
              </View>
              <StatusPill label={statusLabel[item.status]} tone={item.status === 'active' || item.status === 'approved' ? 'verified' : 'neutral'} />
            </View>
            {item.amount ? <Body style={styles.line}>Amount: {formatKes(item.amount)}</Body> : null}
            {item.nextPaymentDate ? <Body style={styles.line}>Next payment: {formatDate(item.nextPaymentDate)}</Body> : null}
            {item.balance ? <Body style={styles.line}>Balance: {formatKes(item.balance)}</Body> : null}
            <Caption style={{ marginTop: spacing.md }}>Updated {formatDate(item.updatedAt)}</Caption>
          </Card>
        )) : <EmptyState title="No institution assessment yet" body="When you share your Passport with a participating institution, their status can appear here." />}
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Add a record" onPress={() => router.push('/add')} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  stateCard: { marginTop: spacing.xl, backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  line: { marginTop: spacing.md, fontWeight: '700' }
});
