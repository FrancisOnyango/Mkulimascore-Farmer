import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { colors, radius, spacing } from '@/constants/theme';

export default function AddCost() {
  const { enterprises, refresh } = useAppData();
  const params = useLocalSearchParams<{ enterpriseId?: string; farmId?: string }>();
  const requestedEnterpriseId = firstParam(params.enterpriseId);
  const requestedFarmId = firstParam(params.farmId);
  const enterprise = useMemo(() => {
    return enterprises.find((item) => item.id === requestedEnterpriseId)
      ?? enterprises.find((item) => item.farmId === requestedFarmId && item.primary)
      ?? enterprises.find((item) => item.farmId === requestedFarmId)
      ?? enterprises.find((item) => item.primary)
      ?? enterprises[0];
  }, [enterprises, requestedEnterpriseId, requestedFarmId]);
  const [draft, setDraft, clearDraft] = useFormDraft(`cost:${enterprise?.id ?? 'new'}`, { category: defaultCostCategory(enterprise?.sector), amount: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const costAmount = Number(draft.amount);
    if (!enterprise) return setError('No enterprise is available yet.');
    if (!draft.category.trim()) return setError('Enter a cost category.');
    if (!Number.isFinite(costAmount) || costAmount <= 0) return setError('Enter an amount greater than zero.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitCost({
        enterpriseId: enterprise.id,
        category: draft.category.trim(),
        amount: costAmount,
        currency: 'KES',
        occurredAt: new Date().toISOString(),
        note: draft.note.trim() || undefined
      });
      await clearDraft();
      await refresh();
      Alert.alert('Saved on this phone', 'Will sync when you are online.');
      router.back();
    } catch {
      setError('We could not save this update. Try again. If you are offline, wait for a signal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <H2>Add cost</H2>
      <Body style={styles.lead}>Add feed, input or other farm costs. It is marked as added by you.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Enterprise</Caption>
        <H3 style={{ marginTop: 4 }}>{enterprise?.name ?? 'No enterprise available'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>{enterprise ? enterprise.sector : 'Add an enterprise before recording a cost.'}</Caption>
        <Text style={styles.label}>Cost category</Text>
        <TextInput accessibilityLabel="Cost category" value={draft.category} onChangeText={(category) => setDraft((current) => ({ ...current, category }))} autoCapitalize="words" returnKeyType="next" placeholder="Feed, inputs, vet..." style={styles.input} />
        <Text style={styles.label}>Amount</Text>
        <TextInput accessibilityLabel="Cost amount" value={draft.amount} onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))} keyboardType="decimal-pad" returnKeyType="next" placeholder="3200" style={styles.input} />
        <Text style={styles.label}>Note, optional</Text>
        <TextInput accessibilityLabel="Cost note, optional" value={draft.note} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} returnKeyType="done" placeholder="Receipt or supplier details" style={styles.input} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Saving...' : 'Save cost'} disabled={saving || !enterprise} onPress={save} />
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultCostCategory(sector?: string) {
  if (sector === 'Dairy' || sector === 'Poultry') return 'Feed';
  if (sector === 'Maize' || sector === 'Avocado' || sector === 'Coffee' || sector === 'Tea') return 'Inputs';
  return 'Farm cost';
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 16 },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
