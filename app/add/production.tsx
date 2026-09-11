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

export default function AddProduction() {
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
  const [draft, setDraft, clearDraft] = useFormDraft(`production:${enterprise?.id ?? 'new'}`, { quantity: '', morning: '', evening: '', buyer: enterprise?.buyer ?? '' });
  const dairy = enterprise?.sector === 'Dairy';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const morning = Number(draft.morning);
    const evening = Number(draft.evening);
    const combined = dairy ? (Number.isFinite(morning) ? morning : 0) + (Number.isFinite(evening) ? evening : 0) : Number(draft.quantity);
    const value = combined;
    if (!enterprise) return setError('No enterprise is available yet.');
    if (!Number.isFinite(value) || value <= 0) return setError(dairy ? 'Enter morning or evening litres.' : 'Enter a production amount greater than zero.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitProduction({
        enterpriseId: enterprise.id,
        metric: productionMetricFor(enterprise.sector),
        quantity: value,
        unit: productionUnitFor(enterprise.sector),
        occurredAt: new Date().toISOString(),
        buyer: draft.buyer,
        note: dairy && (draft.morning || draft.evening) ? `Morning ${draft.morning || 0} L · Evening ${draft.evening || 0} L` : 'Added by you'
      });
      await clearDraft();
      await refresh();
      Alert.alert('Saved on this phone', 'Will sync when you are online.');
      router.back();
    } catch {
      setError('Could not save production. Your information was not queued.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <H2>Record production</H2>
      <Body style={styles.lead}>A quick update strengthens your enterprise history. It stays farmer-reported until supported or verified.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Enterprise</Caption>
        <H3 style={{ marginTop: 4 }}>{enterprise?.name ?? 'No enterprise available'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>{enterprise ? enterprise.sector : 'Add an enterprise before recording production.'}</Caption>
        {dairy ? (
          <>
            <Text style={styles.label}>Morning litres</Text>
            <View style={styles.quantityRow}>
              <TextInput accessibilityLabel="Morning litres" value={draft.morning} onChangeText={(morning) => setDraft((current) => ({ ...current, morning }))} keyboardType="decimal-pad" placeholder="12" style={styles.input} />
              <View style={styles.unit}><Text style={styles.unitText}>litres</Text></View>
            </View>
            <Text style={styles.label}>Evening litres</Text>
            <View style={styles.quantityRow}>
              <TextInput accessibilityLabel="Evening litres" value={draft.evening} onChangeText={(evening) => setDraft((current) => ({ ...current, evening }))} keyboardType="decimal-pad" placeholder="10" style={styles.input} />
              <View style={styles.unit}><Text style={styles.unitText}>litres</Text></View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>How much did you produce today?</Text>
            <View style={styles.quantityRow}>
              <TextInput accessibilityLabel="Production quantity" value={draft.quantity} onChangeText={(quantity) => setDraft((current) => ({ ...current, quantity }))} keyboardType="decimal-pad" returnKeyType="next" placeholder="64" style={styles.input} />
              <View style={styles.unit}><Text style={styles.unitText}>{enterprise ? productionUnitFor(enterprise.sector) : 'units'}</Text></View>
            </View>
          </>
        )}
        <Text style={styles.label}>Main buyer, optional</Text>
        <TextInput accessibilityLabel="Main buyer" value={draft.buyer} onChangeText={(buyer) => setDraft((current) => ({ ...current, buyer }))} autoCapitalize="words" returnKeyType="done" placeholder="Buyer / cooperative" style={styles.input} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Saving...' : 'Save production'} disabled={saving || !enterprise} onPress={save} />
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function productionMetricFor(sector: string) {
  if (sector === 'Dairy') return 'milk_produced';
  if (sector === 'Poultry') return 'eggs_or_birds_produced';
  if (sector === 'Tea') return 'green_leaf_delivered';
  if (sector === 'Coffee') return 'cherry_delivered';
  return 'production';
}

function productionUnitFor(sector: string) {
  if (sector === 'Dairy') return 'litres';
  if (sector === 'Poultry') return 'units';
  if (sector === 'Tea' || sector === 'Coffee') return 'kg';
  if (sector === 'Maize') return 'bags';
  return 'units';
}
const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { flex: 1, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 16 },
  quantityRow: { flexDirection: 'row', gap: spacing.sm },
  unit: { minWidth: 85, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  unitText: { color: colors.brandDark, fontWeight: '800' },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
