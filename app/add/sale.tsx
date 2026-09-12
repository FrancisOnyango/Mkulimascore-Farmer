import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { SuggestInput } from '@/components/SuggestInput';
import { DateField, occurredAtFromField } from '@/components/DateField';
import { MoneyField } from '@/components/MoneyField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { buyerSuggestions, productionUnitFor } from '@/lib/onboarding/valueChains';
import { type DayChoice } from '@/lib/forms/dates';
import { colors, spacing } from '@/constants/theme';

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
  const [draft, setDraft, clearDraft] = useFormDraft(`sale:${enterprise?.id ?? 'new'}`, {
    amount: '',
    quantity: '',
    buyer: enterprise?.buyer ?? '',
    day: 'today' as DayChoice,
    customDate: ''
  });
  const unit = enterprise ? productionUnitFor(enterprise.sector) : 'units';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const saleAmount = Number(draft.amount.replace(/,/g, ''));
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
        unit,
        buyer: draft.buyer.trim() || undefined,
        occurredAt: occurredAtFromField(draft.day ?? 'today', draft.customDate ?? ''),
        note: 'Added by you'
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
      <Body style={styles.lead}>Record money received. This is not full accounts — just what you were paid.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Enterprise</Caption>
        <H3 style={{ marginTop: 4 }}>{enterprise?.name ?? 'No enterprise available'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>{enterprise ? enterprise.sector : 'Add an enterprise before recording a sale.'}</Caption>
        <View style={{ marginTop: spacing.lg }}>
          <MoneyField
            label="Amount received"
            value={draft.amount}
            onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))}
            hint="What you were paid after any deduction you know."
          />
        </View>
        <Input
          label={`Quantity, optional (${unit})`}
          value={draft.quantity}
          onChangeText={(quantity) => setDraft((current) => ({ ...current, quantity }))}
          keyboardType="decimal-pad"
          placeholder="64"
          hint="Bags, litres or kilos sold."
        />
        <SuggestInput
          label="Buyer, optional"
          value={draft.buyer}
          onChangeText={(buyer) => setDraft((current) => ({ ...current, buyer }))}
          autoCapitalize="words"
          placeholder="Who paid you?"
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
        <PrimaryButton label={saving ? 'Saving...' : 'Save sale'} disabled={saving || !enterprise} onPress={save} />
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
