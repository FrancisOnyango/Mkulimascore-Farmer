import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1 } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import { FarmerRow, FarmerSection, FarmerStatusPanel } from '@/components/FarmerUX';
import { useAppData } from '@/context/AppDataContext';
import type { EvidenceRecord } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

const groups = [
  { key: 'identity', label: 'Identity & consent', terms: ['identity', 'id', 'consent', 'profile'] },
  { key: 'farm', label: 'Farm & enterprises', terms: ['farm', 'enterprise', 'boundary', 'map', 'acreage', 'livestock'] },
  { key: 'production', label: 'Production', terms: ['production', 'delivery', 'harvest', 'milk', 'yield', 'stock'] },
  { key: 'market', label: 'Market activity', terms: ['sale', 'buyer', 'market', 'receipt'] },
  { key: 'financial', label: 'Financial', terms: ['cost', 'expense', 'payment', 'mpesa', 'm-pesa', 'statement', 'loan'] },
  { key: 'cooperative', label: 'Cooperative', terms: ['cooperative', 'sacco', 'coop'] }
] as const;

type GroupKey = typeof groups[number]['key'];

export default function Records() {
  const { records, consents } = useAppData();
  const [selected, setSelected] = useState<GroupKey | 'all'>('all');
  const verified = useMemo(() => records.filter((record) => record.status === 'verified').length, [records]);
  const waiting = useMemo(() => records.filter((record) => ['queued', 'uploading', 'received', 'processing'].includes(record.status)).length, [records]);
  const needsReview = useMemo(() => records.filter((record) => ['needs_review', 'replacement_requested', 'failed', 'rejected'].includes(record.status)).length, [records]);
  const summaries = useMemo(() => groups.map((group) => summarizeGroup(group.key, records, consents.length)), [consents.length, records]);
  const shown = useMemo(() => selected === 'all' ? records : records.filter((record) => recordGroup(record) === selected), [records, selected]);

  return (
    <AppShell>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <H1>My Records</H1>
          <Body style={styles.lead}>The evidence you are building for your farm history.</Body>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add record" onPress={() => router.push({ pathname: '/add', params: { context: 'records' } })} style={styles.addButton}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>

      <FarmerStatusPanel
        eyebrow="Evidence progress"
        title={records.length ? `${verified} verified records` : 'No records yet'}
        body={records.length ? `${waiting} waiting for review, ${needsReview} need attention. Your records become more useful as dates, amounts and sources stay clear.` : 'Add your first production, sale, cost or cooperative record to start building farm history.'}
        statusLabel={records.length ? `${records.length} total` : 'Start here'}
        statusTone={needsReview ? 'attention' : verified ? 'verified' : 'neutral'}
        primaryAction={{ label: 'Add record', onPress: () => router.push({ pathname: '/add', params: { context: 'records' } }) }}
        secondaryAction={{ label: 'View Passport', onPress: () => router.push('/passport') }}
      />

      <FarmerSection title="Record areas" detail="Plain categories, not technical evidence codes.">
        {summaries.map((item, index) => (
          <FarmerRow
            key={item.key}
            value={item.label}
            label={item.detail}
            status={item.status}
            tone={item.tone}
            onPress={() => setSelected(item.key)}
            last={index === summaries.length - 1}
          />
        ))}
      </FarmerSection>

      <View style={styles.filters}>
        <Filter label="All" active={selected === 'all'} onPress={() => setSelected('all')} />
        {groups.map((group) => <Filter key={group.key} label={group.label} active={selected === group.key} onPress={() => setSelected(group.key)} />)}
      </View>

      <FarmerSection title={selected === 'all' ? 'All saved records' : groups.find((group) => group.key === selected)?.label ?? 'Saved records'} detail="Open a record to review status, source and upload actions.">
        {shown.length ? shown.map((record, index) => (
          <FarmerRow
            key={record.id}
            value={record.title}
            label={`${record.source} / ${formatDate(record.documentDate)}`}
            detail={record.category}
            status={statusLabel(record.status)}
            tone={statusTone(record.status)}
            onPress={() => router.push(`/records/${record.id}`)}
            last={index === shown.length - 1}
          />
        )) : (
          <EmptyState
            title={selected === 'all' ? 'No records yet' : `No ${groups.find((group) => group.key === selected)?.label.toLowerCase()} records yet`}
            body="Add the next useful piece of evidence when something real happens on the farm."
            action="Add record"
            onAction={() => router.push({ pathname: '/add', params: { context: 'records' } })}
          />
        )}
      </FarmerSection>

      <Caption style={styles.note}>Records can support reviews when you give permission. A saved record is not automatically verified.</Caption>
    </AppShell>
  );
}

function Filter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.filter, active && styles.filterActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function summarizeGroup(key: GroupKey, records: EvidenceRecord[], consentCount: number) {
  const count = records.filter((record) => recordGroup(record) === key).length;
  const verified = records.filter((record) => recordGroup(record) === key && record.status === 'verified').length;
  const label = groups.find((group) => group.key === key)?.label ?? key;
  if (key === 'identity' && consentCount > 0) {
    return { key, label, detail: `${consentCount} permission${consentCount === 1 ? '' : 's'} connected`, status: 'Available', tone: 'verified' as const };
  }
  if (!count) return { key, label, detail: 'Add when relevant', status: 'Missing', tone: 'neutral' as const };
  if (verified === count) return { key, label, detail: `${count} verified`, status: 'Verified', tone: 'verified' as const };
  return { key, label, detail: `${count} available, ${verified} verified`, status: verified ? 'Available' : 'Waiting', tone: verified ? 'good' as const : 'attention' as const };
}

function recordGroup(record: EvidenceRecord): GroupKey {
  const haystack = `${record.category} ${record.title} ${record.source}`.toLowerCase();
  return groups.find((group) => group.terms.some((term) => haystack.includes(term)))?.key ?? 'production';
}

function statusLabel(status: EvidenceRecord['status']) {
  if (status === 'needs_review') return 'Needs review';
  if (status === 'replacement_requested') return 'Replace';
  if (status === 'queued') return 'Waiting';
  if (status === 'uploading') return 'Sending';
  if (status === 'failed') return 'Try again';
  if (status === 'rejected') return 'Not accepted';
  if (status === 'processing' || status === 'received') return 'Reviewing';
  return status === 'verified' ? 'Verified' : 'Draft';
}

function statusTone(status: EvidenceRecord['status']): 'verified' | 'attention' | 'neutral' {
  if (status === 'verified') return 'verified';
  if (['needs_review', 'replacement_requested', 'failed', 'rejected'].includes(status)) return 'attention';
  return 'neutral';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xl },
  lead: { color: colors.muted, marginTop: spacing.sm },
  addButton: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xxl },
  filter: { minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  filterActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  filterText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  filterTextActive: { color: '#fff' },
  note: { marginTop: spacing.xxxl, textAlign: 'center', paddingHorizontal: spacing.lg }
});
