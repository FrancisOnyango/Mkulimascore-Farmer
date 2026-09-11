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

export default function AddSale() {
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
  const [draft, setDraft, clearDraft] = useFormDraft(`sale:${enterprise?.id ?? 'new'}`, { amount: '', quantity: '', buyer: enterprise?.buyer ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const saleAmount = Number(draft.amount);
    const saleQuantity = draft.quantity.trim() ? Number(draft.quantity) : null;
    if (!enterprise) return setError('No enterprise is available yet.');
    if (!Number.isFinite(saleAmount) || saleAmount <= 0) return setError('Enter a sale amount greater than zero.');
    if (draft.quantity.trim() && (!Number.isFinite(saleQuantity) || (saleQuantity ?? 0) <= 0)) return setError('Enter a valid quantity greater than zero.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitSale({
        enterpriseId: enterprise.id,
        amount: saleAmount,
        currency: 'KES',
        quantity: saleQuantity && Number.isFinite(saleQuantity) ? saleQuantity : null,
        unit: unitForSale(enterprise.sector),
        buyer: draft.buyer.trim() || undefined,
        occurredAt: new Date().toISOString(),
        note: 'Submitted through farmer self-service app'
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
      <H2>Add sale</H2>
      <Body style={styles.lead}>Record money received from a sale. It is marked as added by you.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Enterprise</Caption>
        <H3 style={{ marginTop: 4 }}>{enterprise?.name ?? 'No enterprise available'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>{enterprise ? enterprise.sector : 'Add an enterprise before recording a sale.'}</Caption>
        <Text style={styles.label}>Sale amount</Text>
        <TextInput accessibilityLabel="Sale amount" value={draft.amount} onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))} keyboardType="decimal-pad" returnKeyType="next" placeholder="8500" style={styles.input} />
        <Text style={styles.label}>Quantity, optional</Text>
        <TextInput accessibilityLabel="Sale quantity, optional" value={draft.quantity} onChangeText={(quantity) => setDraft((current) => ({ ...current, quantity }))} keyboardType="decimal-pad" returnKeyType="next" placeholder="64" style={styles.input} />
        <Text style={styles.label}>Buyer, optional</Text>
        <TextInput accessibilityLabel="Buyer" value={draft.buyer} onChangeText={(buyer) => setDraft((current) => ({ ...current, buyer }))} autoCapitalize="words" returnKeyType="done" placeholder="Buyer / cooperative" style={styles.input} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Saving...' : 'Save sale'} disabled={saving || !enterprise} onPress={save} />
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function unitForSale(sector: string) {
  if (sector === 'Dairy') return 'litres';
  if (sector === 'Tea' || sector === 'Coffee') return 'kg';
  if (sector === 'Maize') return 'bags';
  if (sector === 'Poultry') return 'units';
  return null;
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 16 },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
