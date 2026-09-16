import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { SuggestInput } from '@/components/SuggestInput';
import { EvidenceAttach } from '@/components/EvidenceAttach';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { colors, radius, spacing } from '@/constants/theme';

export default function Correction() {
  const { passport, farms, refresh } = useAppData();
  const defaultFarm = useMemo(() => farms[0], [farms]);
  const [draft, setDraft, clearDraft] = useFormDraft('correction', {
    field: 'Farm area',
    currentValue: defaultFarm ? `${defaultFarm.reportedArea} ${defaultFarm.areaUnit}` : '',
    proposedValue: '',
    reason: '',
    evidenceUri: null as string | null
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!passport) return setError('Your passport is not available yet.');
    if (!draft.field.trim()) return setError('Enter the information to correct.');
    if (!draft.proposedValue.trim()) return setError('Enter the proposed value.');
    if (!draft.reason.trim()) return setError('Explain why this correction should be reviewed.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitCorrection({
        entityType: defaultFarm ? 'farm' : 'passport',
        entityId: defaultFarm?.id ?? passport.msid,
        field: draft.field.trim(),
        currentValue: draft.currentValue.trim() || 'Not shown',
        proposedValue: draft.proposedValue.trim(),
        reason: draft.reason.trim(),
        evidenceUri: draft.evidenceUri
      });
      await clearDraft();
      await refresh();
      Alert.alert('Correction case opened', 'Saved on this phone as “You challenged this”. Confirmed details stay until review finishes.');
      router.back();
    } catch {
      setError('We could not save this request. Try again when you have a signal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <H2>Request correction</H2>
      <Body style={styles.lead}>Tell us what looks wrong. Confirmed details stay as they are until review. Your proposal is saved as a case — not a silent overwrite.</Body>
      <Card style={styles.statusCard}>
        <Caption>Case status</Caption>
        <H3 style={{ marginTop: 4 }}>You challenged this</H3>
        <Body style={{ marginTop: spacing.sm }}>Current value stays visible. Your proposed value waits for review. This is not a score change.</Body>
      </Card>
      <Card style={{ marginTop: spacing.md }}>
        <Caption>Current displayed value</Caption>
        <H3 style={{ marginTop: 4 }}>{draft.currentValue || 'Not shown'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>Added by you or last verified value — both stay in history.</Caption>
        <SuggestInput
          label="Information to correct"
          value={draft.field}
          onChangeText={(field) => setDraft((current) => ({ ...current, field }))}
          autoCapitalize="sentences"
          placeholder="Farm area, buyer or location"
          suggestions={['Farm area', 'Farm place', 'Buyer', 'Enterprise', 'Location']}
        />
        <Input
          label="Proposed value"
          value={draft.proposedValue}
          onChangeText={(proposedValue) => setDraft((current) => ({ ...current, proposedValue }))}
          autoCapitalize="sentences"
          placeholder="What should it say?"
          hint="Write the correct figure or name."
        />
        <Input
          label="Reason"
          value={draft.reason}
          onChangeText={(reason) => setDraft((current) => ({ ...current, reason }))}
          autoCapitalize="sentences"
          placeholder="Why should this be reviewed?"
          multiline
        />
        <Caption style={{ marginTop: spacing.md }}>Supporting evidence, optional</Caption>
        <EvidenceAttach
          uri={draft.evidenceUri}
          onCaptured={(file) => setDraft((current) => ({ ...current, evidenceUri: file.uri }))}
          onClear={() => setDraft((current) => ({ ...current, evidenceUri: null }))}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Submitting...' : 'Submit correction'} disabled={saving || !passport} onPress={save} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  statusCard: { marginTop: spacing.xl, backgroundColor: colors.warm, borderColor: '#E7D7AE' },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
