import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { SuggestInput } from '@/components/SuggestInput';
import { DateField, occurredAtFromField } from '@/components/DateField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { buyerSuggestions, productionMetricFor, productionUnitFor } from '@/lib/onboarding/valueChains';
import { type DayChoice } from '@/lib/forms/dates';
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
  const [draft, setDraft, clearDraft] = useFormDraft(`production:${enterprise?.id ?? 'new'}`, {
    quantity: '',
    morning: '',
    evening: '',
    buyer: enterprise?.buyer ?? '',
    day: 'today' as DayChoice,
    customDate: ''
  });
  const dairy = enterprise?.sector === 'Dairy';
  const unit = enterprise ? productionUnitFor(enterprise.sector) : 'units';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const morning = Number(draft.morning);
    const evening = Number(draft.evening);
    const combined = dairy ? (Number.isFinite(morning) ? morning : 0) + (Number.isFinite(evening) ? evening : 0) : Number(draft.quantity);
    if (!enterprise) return setError('No enterprise is available yet.');
    if (!Number.isFinite(combined) || combined <= 0) return setError(dairy ? 'Enter morning or evening litres.' : 'Enter a production amount greater than zero.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitProduction({
        enterpriseId: enterprise.id,
        metric: productionMetricFor(enterprise.sector),
        quantity: combined,
        unit,
        occurredAt: occurredAtFromField(draft.day ?? 'today', draft.customDate ?? ''),
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
      <H2>{dairy ? "Record today's milk" : 'Record production'}</H2>
      <Body style={styles.lead}>A short note is enough. It stays added by you until a partner confirms it.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Recording for</Caption>
        <H3 style={{ marginTop: 4 }}>{enterprise?.name ?? 'No enterprise available'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>
          {enterprise
            ? `${enterprise.sector} · Added by you until a partner confirms it`
            : 'Add an enterprise before recording production.'}
        </Caption>
        {dairy ? (
          <>
            <Input label="Morning litres" value={draft.morning} onChangeText={(morning) => setDraft((current) => ({ ...current, morning }))} keyboardType="decimal-pad" placeholder="12" hint="What you delivered or stored this morning." />
            <Input label="Evening litres" value={draft.evening} onChangeText={(evening) => setDraft((current) => ({ ...current, evening }))} keyboardType="decimal-pad" placeholder="10" hint="Leave blank if you only milk once." />
          </>
        ) : (
          <View style={styles.quantity}>
            <View style={{ flex: 1 }}>
              <Input label="How much?" value={draft.quantity} onChangeText={(quantity) => setDraft((current) => ({ ...current, quantity }))} keyboardType="decimal-pad" placeholder="64" hint={`Use ${unit} if you can.`} />
            </View>
            <View style={styles.unit}><Text style={styles.unitText}>{unit}</Text></View>
          </View>
        )}
        <SuggestInput
          label="Main buyer, optional"
          value={draft.buyer}
          onChangeText={(buyer) => setDraft((current) => ({ ...current, buyer }))}
          autoCapitalize="words"
          placeholder="Cooperative, factory or market"
          hint="Who usually takes this produce?"
          suggestions={buyerSuggestions(enterprise?.sector)}
        />
        <DateField
          choice={draft.day ?? 'today'}
          custom={draft.customDate ?? ''}
          onChoice={(day) => setDraft((current) => ({ ...current, day }))}
          onCustom={(customDate) => setDraft((current) => ({ ...current, customDate }))}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Saving...' : dairy ? 'Save milk' : 'Save production'} disabled={saving || !enterprise} onPress={save} />
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  quantity: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  unit: { minWidth: 88, minHeight: 54, marginBottom: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  unitText: { color: colors.brandDark, fontWeight: '800', textAlign: 'center', paddingHorizontal: spacing.sm },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
