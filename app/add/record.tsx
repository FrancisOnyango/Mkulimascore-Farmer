import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useAppData } from '@/context/AppDataContext';
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
    title: requestedCategory ? `${requestedCategory} record` : 'Farm record',
    source: requestedInstitution ?? 'Farmer upload',
    category: requestedCategory && categories.includes(requestedCategory) ? requestedCategory : 'Production',
    uri: null as string | null
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission', 'Camera access is needed only when you choose to photograph a record.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.78, mediaTypes: ['images'] });
      if (!result.canceled) setDraft((current) => ({ ...current, uri: result.assets[0]?.uri ?? null }));
    } catch {
      Alert.alert('Camera unavailable', 'Type a place or add a record later. Camera is not available in this install.');
    }
  }

  async function chooseDocument() {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled) setDraft((current) => ({ ...current, uri: result.assets[0]?.uri ?? null }));
    } catch {
      Alert.alert('Files unavailable', 'You can still add details later. File picker is not available in this install.');
    }
  }

  async function save() {
    if (!draft.title.trim()) return setError('Enter a record title.');
    if (!draft.uri) return setError('Add a photo or choose a document first.');
    setError(null);
    setSaving(true);
    try {
      await FarmerAppService.submitEvidence({
        category: draft.category,
        title: draft.title.trim(),
        source: draft.source.trim() || 'Farmer upload',
        documentDate: new Date().toISOString(),
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
      <H2>Add a record</H2>
      <Body style={styles.lead}>Add a photo or document from the farm. You choose later who can see it.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Caption>Record title</Caption>
        <TextInput accessibilityLabel="Record title" value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} autoCapitalize="sentences" returnKeyType="next" style={styles.input} />
        <Caption style={{ marginTop: spacing.lg }}>Category</Caption>
        <View style={styles.categories}>
          {categories.map((item) => (
            <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: item === draft.category }} accessibilityLabel={`Category ${item}`} onPress={() => setDraft((current) => ({ ...current, category: item }))} style={[styles.category, item === draft.category && styles.categoryActive]}>
              <Text style={[styles.categoryText, item === draft.category && styles.categoryTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Caption style={{ marginTop: spacing.lg }}>Source</Caption>
        <TextInput accessibilityLabel="Record source" value={draft.source} onChangeText={(source) => setDraft((current) => ({ ...current, source }))} autoCapitalize="words" returnKeyType="done" style={styles.input} />
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <PrimaryButton label="Take photo" variant="secondary" onPress={takePhoto} />
          <PrimaryButton label="Choose document" variant="secondary" onPress={chooseDocument} />
        </View>
        {draft.uri ? <Caption style={{ marginTop: spacing.md }}>Selected: {draft.uri.split('/').pop()}</Caption> : null}
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
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  category: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  categoryActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  categoryText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#fff' },
  input: { marginTop: spacing.sm, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 16 },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' }
});
