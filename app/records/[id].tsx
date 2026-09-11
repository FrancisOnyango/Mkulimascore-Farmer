import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { DataRow } from '@/components/DataRow';
import { StatusPill } from '@/components/StatusPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import type { EvidenceRecord } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useAppData();

  async function load() {
    if (!id) return;
    setRecord(await FarmerAppService.getEvidenceRecord(id));
  }

  useEffect(() => { void load(); }, [id]);

  if (!record) return <AppShell><Body>Loading record...</Body></AppShell>;

  async function openFile() {
    if (!record?.localUri) {
      Alert.alert('No local file', 'This record does not have a local photo or document attached on this phone.');
      return;
    }
    const canOpen = await Linking.canOpenURL(record.localUri);
    if (!canOpen) {
      Alert.alert('Cannot open file', 'This phone cannot open the selected file from the app cache.');
      return;
    }
    await Linking.openURL(record.localUri);
  }

  async function retry() {
    if (!record || busy) return;
    setBusy(true);
    try {
      const updated = await FarmerAppService.retryEvidenceRecordUpload(record.id);
      if (updated) setRecord(updated);
      await refresh();
      Alert.alert('Queued for retry', 'This record will be sent again when sync runs.');
    } catch {
      Alert.alert('Retry failed', 'We could not queue this record again. Please try later.');
    } finally {
      setBusy(false);
    }
  }

  async function markNeedsReview() {
    if (!record || busy) return;
    setBusy(true);
    try {
      const updated = await FarmerAppService.updateEvidenceRecordStatus(record.id, 'needs_review');
      if (updated) setRecord(updated);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!record || busy || record.status === 'verified') return;
    Alert.alert('Remove record?', 'This removes the local evidence entry and any unsent upload for it. Verified records cannot be removed from the phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void (async () => {
          setBusy(true);
          try {
            const deleted = await FarmerAppService.deleteEvidenceRecord(record.id);
            await refresh();
            if (deleted) router.back();
          } finally {
            setBusy(false);
          }
        })()
      }
    ]);
  }

  return (
    <AppShell>
      <Eyebrow>{record.category}</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{record.title}</H2>
      <Caption>{record.source}</Caption>

      <Card style={{ marginTop: spacing.xl }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <H3>Verification state</H3>
            <Body style={{ marginTop: spacing.sm }}>{statusCopy(record.status)}</Body>
          </View>
          <StatusPill label={statusLabel(record.status)} tone={record.status === 'verified' ? 'verified' : record.status === 'needs_review' || record.status === 'replacement_requested' ? 'attention' : 'neutral'} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <DataRow label="Document date" value={formatDate(record.documentDate)} />
        <DataRow label="Source" value={record.source} />
        <DataRow label="Upload state" value={statusLabel(record.status)} />
        <DataRow label="Evidence provenance" value={record.verification === 'verified' ? 'Verified' : record.verification === 'supported' ? 'Supported' : 'Farmer reported'} />
        <DataRow label="Server reference" value={record.serverId ?? 'Pending ingestion'} />
        <DataRow label="Local file" value={record.localUri ? record.localUri.split('/').pop() ?? 'Selected file' : 'No local file shown'} last />
      </Card>

      <Card style={styles.actionsCard}>
        <H3>Record actions</H3>
        <Body style={{ marginTop: spacing.sm }}>Use these controls to keep the record lifecycle moving without losing the evidence trail.</Body>
        <View style={styles.actions}>
          <PrimaryButton label="Open file" variant="secondary" onPress={openFile} disabled={!record.localUri || busy} />
          <PrimaryButton label={busy ? 'Working...' : 'Retry upload'} onPress={retry} disabled={busy || record.status === 'verified'} />
        </View>
        <View style={styles.secondaryActions}>
          <Pressable accessibilityRole="button" onPress={markNeedsReview} disabled={busy || record.status === 'verified'} style={[styles.secondaryAction, (busy || record.status === 'verified') && styles.disabled]}>
            <Text style={styles.secondaryText}>Mark needs review</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={remove} disabled={busy || record.status === 'verified'} style={[styles.deleteAction, (busy || record.status === 'verified') && styles.disabled]}>
            <Text style={styles.deleteText}>Remove local record</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <H3>What this contributes to</H3>
        <Body style={{ marginTop: spacing.sm }}>{contributionCopy(record.category)}</Body>
      </Card>

      <Caption style={styles.note}>Uploading evidence does not automatically make it verified. Records are reviewed through the MkulimaScore evidence pipeline.</Caption>
    </AppShell>
  );
}

function statusLabel(status: EvidenceRecord['status']) {
  if (status === 'draft') return 'Draft';
  if (status === 'queued') return 'Queued';
  if (status === 'uploading') return 'Uploading';
  if (status === 'failed') return 'Failed';
  if (status === 'rejected') return 'Rejected';
  if (status === 'needs_review') return 'Needs review';
  if (status === 'replacement_requested') return 'Replacement requested';
  if (status === 'received') return 'Received';
  if (status === 'processing') return 'Processing';
  return 'Verified';
}

function statusCopy(status: EvidenceRecord['status']) {
  if (status === 'draft') return 'This record is still a draft and has not been queued.';
  if (status === 'queued') return 'This record is saved on this phone and waiting to upload.';
  if (status === 'uploading') return 'This record is currently being uploaded.';
  if (status === 'failed') return 'The last upload attempt failed. You can retry when connected.';
  if (status === 'rejected') return 'This record was rejected and should be replaced or reviewed.';
  if (status === 'verified') return 'This record has been accepted as verified evidence.';
  if (status === 'processing') return 'This record has been received and is being checked.';
  if (status === 'needs_review') return 'This record needs additional review before it can strengthen the verified profile.';
  if (status === 'replacement_requested') return 'A clearer or more current replacement has been requested.';
  return 'This record has been received as farmer-submitted evidence.';
}

function contributionCopy(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('production')) return 'Production trend, enterprise performance and readiness freshness.';
  if (normalized.includes('input')) return 'Cost evidence, enterprise economics and margin understanding.';
  if (normalized.includes('financial')) return 'Approved financial evidence where permission has been granted.';
  if (normalized.includes('cooperative')) return 'Buyer history, delivery consistency and market context.';
  return 'Your farmer-safe Passport and evidence history.';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  actionsCard: { marginTop: spacing.md, backgroundColor: colors.surfaceAlt },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  secondaryAction: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryText: { color: colors.brandDark, fontWeight: '900', fontSize: 12 },
  deleteAction: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: '#E7C8BF', backgroundColor: colors.claySoft, justifyContent: 'center', paddingHorizontal: spacing.md },
  deleteText: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.45 },
  note: { textAlign: 'center', marginTop: spacing.xxl }
});
