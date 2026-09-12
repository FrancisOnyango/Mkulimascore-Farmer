import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { DateField, occurredAtFromField } from '@/components/DateField';
import { MoneyField } from '@/components/MoneyField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { costCategories, defaultCostCategory } from '@/lib/onboarding/valueChains';
import { type DayChoice } from '@/lib/forms/dates';
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
  const categories = costCategories(enterprise?.sector);
  const [draft, setDraft, clearDraft] = useFormDraft(`cost:${enterprise?.id ?? 'new'}`, {
    category: defaultCostCategory(enterprise?.sector),
    amount: '',
    note: '',
    day: 'today' as DayChoice,
    customDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const costAmount = Number(draft.amount.replace(/,/g, ''));
    if (!enterprise) return setError('No enterprise is available yet.');
    if (!draft.category.trim()) return setError('Choose a cost category.');
    if (!Number.isFinite(costAmount) || costAmount <= 0) return setError('Enter an amount greater than zero.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitCost({
        enterpriseId: enterprise.id,
        category: draft.category.trim(),
        amount: costAmount,
        currency: 'KES',
        occurredAt: occurredAtFromField(draft.day ?? 'today', draft.customDate ?? ''),
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
      <H2>Add a farm cost</H2>
      <Body style={styles.lead}>Feed, seed, labour or transport. Enough to see a margin later — not full bookkeeping.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Enterprise</Caption>
        <H3 style={{ marginTop: 4 }}>{enterprise?.name ?? 'No enterprise available'}</H3>
        <Caption style={{ marginTop: spacing.xs }}>{enterprise ? enterprise.sector : 'Add an enterprise before recording a cost.'}</Caption>
        <Caption style={styles.label}>What was this for?</Caption>
        <View style={styles.chips}>
          {categories.map((item) => (
            <Pressable
              key={item}
              onPress={() => setDraft((current) => ({ ...current, category: item }))}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.category === item }}
              style={[styles.chip, draft.category === item && styles.chipOn]}
            >
              <Text style={[styles.chipText, draft.category === item && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: spacing.md }}>
          <MoneyField
            label="Amount"
            value={draft.amount}
            onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))}
            hint="What you paid, in Kenya shillings."
          />
        </View>
        <Input
          label="Note, optional"
          value={draft.note}
          onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
          placeholder="Agrovet, casual labour, or receipt number"
          hint="A short note is enough."
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
        <PrimaryButton label={saving ? 'Saving...' : 'Save cost'} disabled={saving || !enterprise} onPress={save} />
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.ink, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
