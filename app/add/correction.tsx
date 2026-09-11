import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
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

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission', 'Camera access is needed only when you choose to photograph supporting evidence.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.78, mediaTypes: ['images'] });
    if (!result.canceled) setDraft((current) => ({ ...current, evidenceUri: result.assets[0]?.uri ?? null }));
  }

  async function chooseDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!result.canceled) setDraft((current) => ({ ...current, evidenceUri: result.assets[0]?.uri ?? null }));
  }

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
      Alert.alert('Saved on this phone', 'We will review this. Confirmed details are not changed quietly.');
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
      <Body style={styles.lead}>Tell us what looks wrong. Confirmed details stay as they are until review.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Current verified value</Caption>
        <H3 style={{ marginTop: 4 }}>{draft.currentValue || 'Not shown'}</H3>
        <Text style={styles.label}>Information to correct</Text>
        <TextInput accessibilityLabel="Information to correct" value={draft.field} onChangeText={(field) => setDraft((current) => ({ ...current, field }))} autoCapitalize="sentences" returnKeyType="next" placeholder="Farm area, buyer, location..." style={styles.input} />
        <Text style={styles.label}>Proposed value</Text>
        <TextInput accessibilityLabel="Proposed value" value={draft.proposedValue} onChangeText={(proposedValue) => setDraft((current) => ({ ...current, proposedValue }))} autoCapitalize="sentences" returnKeyType="next" placeholder="What should it say?" style={styles.input} />
        <Text style={styles.label}>Reason</Text>
        <TextInput accessibilityLabel="Correction reason" value={draft.reason} onChangeText={(reason) => setDraft((current) => ({ ...current, reason }))} autoCapitalize="sentences" returnKeyType="done" placeholder="Explain why this should be reviewed" style={[styles.input, styles.multiline]} multiline />
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <PrimaryButton label="Add photo evidence" variant="secondary" onPress={takePhoto} />
          <PrimaryButton label="Choose evidence document" variant="secondary" onPress={chooseDocument} />
        </View>
        {draft.evidenceUri ? <Caption style={{ marginTop: spacing.md }}>Evidence selected: {draft.evidenceUri.split('/').pop()}</Caption> : null}
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
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
