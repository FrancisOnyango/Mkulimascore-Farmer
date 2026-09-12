import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { SuggestInput } from '@/components/SuggestInput';
import { DateField, occurredAtFromField } from '@/components/DateField';
import { EvidenceAttach } from '@/components/EvidenceAttach';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useAppData } from '@/context/AppDataContext';
import { recordTitleSuggestions } from '@/lib/onboarding/valueChains';
import { type DayChoice } from '@/lib/forms/dates';
import { colors, radius, spacing } from '@/constants/theme';

const categories = ['Production', 'Sales', 'Payments', 'Cooperative', 'Inputs', 'Veterinary', 'Farm', 'Financial', 'Identity'];

export default function AddRecord() {
  const { refresh } = useAppData();
  const params = useLocalSearchParams<{ farmId?: string; enterpriseId?: string; requestId?: string; institution?: string; category?: string }>();
  const farmId = firstParam(params.farmId);
  const enterpriseId = firstParam(params.enterpriseId);
  const requestedCategory = firstParam(params.category);
  const requestedInstitution = firstParam(params.institution);
  const [draft, setDraft, clearDraft] = useFormDraft(`record:${farmId ?? 'no-farm'}:${enterpriseId ?? 'no-enterprise'}:${firstParam(params.requestId) ?? 'general'}`, {
    title: requestedCategory ? `${requestedCategory} record` : '',
    source: requestedInstitution ?? 'Added by you',
    category: requestedCategory && categories.includes(requestedCategory) ? requestedCategory : 'Production',
    uri: null as string | null,
    fileName: null as string | null,
    day: 'today' as DayChoice,
    customDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!draft.title.trim()) return setError('Enter a record title.');
    if (!draft.uri) return setError('Add a photo or choose a document first.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitEvidence({
        category: draft.category,
        title: draft.title.trim(),
        source: draft.source.trim() || 'Added by you',
        documentDate: occurredAtFromField(draft.day ?? 'today', draft.customDate ?? ''),
        localUri: draft.uri,
        associatedFarmId: farmId ?? null,
        associatedEnterpriseId: enterpriseId ?? null
      });
      await clearDraft();
      await refresh();
      Alert.alert('Saved on this phone', 'Will sync when you are online. It stays added by you until it is confirmed.');
      router.back();
    } catch {
      setError('We could not save this update. Your information is still on this phone if it was already chosen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <H2>Add photo evidence</H2>
      <Body style={styles.lead}>A photo of the crop, livestock, receipt or harvest is enough. You choose later who can see it.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <SuggestInput
          label="What is this?"
          value={draft.title}
          onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
          autoCapitalize="sentences"
          placeholder="Harvest photo, receipt or milk slip"
          hint="A short title. Date and place can come from the photo later."
          suggestions={recordTitleSuggestions()}
        />
        <Caption>Category</Caption>
        <View style={styles.categories}>
          {categories.map((item) => (
            <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: item === draft.category }} accessibilityLabel={`Category ${item}`} onPress={() => setDraft((current) => ({ ...current, category: item }))} style={[styles.category, item === draft.category && styles.categoryActive]}>
              <Text style={[styles.categoryText, item === draft.category && styles.categoryTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <SuggestInput
          label="Source"
          value={draft.source}
          onChangeText={(source) => setDraft((current) => ({ ...current, source }))}
          autoCapitalize="words"
          placeholder="Added by you"
          suggestions={['Added by you', 'Cooperative', 'Agrovet', 'Buyer']}
        />
        <DateField
          label="Date on the record"
          choice={draft.day ?? 'today'}
          custom={draft.customDate ?? ''}
          onChoice={(day) => setDraft((current) => ({ ...current, day }))}
          onCustom={(customDate) => setDraft((current) => ({ ...current, customDate }))}
        />
        <Caption style={{ marginTop: spacing.md }}>Attach evidence</Caption>
        <EvidenceAttach
          uri={draft.uri}
          name={draft.fileName}
          onCaptured={(file) => setDraft((current) => ({ ...current, uri: file.uri, fileName: file.name }))}
          onClear={() => setDraft((current) => ({ ...current, uri: null, fileName: null }))}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Saving...' : 'Save record'} disabled={saving} onPress={save} />
      </View>
    </AppShell>
  );
}
function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  category: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  categoryActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  categoryText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#fff' },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
