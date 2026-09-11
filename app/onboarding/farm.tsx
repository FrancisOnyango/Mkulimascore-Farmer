import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { strings } from '@/constants/strings';
import type { FarmTenure, OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

const tenures: { id: FarmTenure; label: string }[] = [
  { id: 'owned', label: 'I own this land' },
  { id: 'family', label: 'Family land' },
  { id: 'leased', label: 'Leased' },
  { id: 'other', label: 'Other arrangement' }
];

export default function FarmOnboarding() {
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'farm' });
  const [locating, setLocating] = useState(false);
  const [accuracyNote, setAccuracyNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => {
      if (session.draft) setDraft({ ...session.draft, step: 'farm' });
    });
  }, []);

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location permission is needed only if you want us to find the farm. You can type a place instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const accuracy = position.coords.accuracy ?? 999;
      const [place] = await Location.reverseGeocodeAsync(position.coords).catch(() => []);
      const placeName = [place?.name, place?.subregion, place?.region].filter(Boolean).join(', ');
      setDraft((current) => ({
        ...current,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        farmLocation: placeName || current.farmLocation || current.county,
        addLocationLater: false
      }));
      setAccuracyNote(accuracy > 80 ? 'GPS is not very precise here. You can still save this as an approximate location.' : strings.farmOnboarding.found);
    } catch {
      setError('We could not read your location. Type a place or add it later.');
    } finally {
      setLocating(false);
    }
  }

  async function continueNext(later = false) {
    const next: OnboardingDraft = {
      ...draft,
      step: 'enterprises',
      addLocationLater: later || draft.addLocationLater,
      farmLocation: later ? draft.farmLocation : draft.farmLocation || draft.county
    };
    await FarmerAppService.saveOnboardingDraft(next);
    router.replace('/onboarding/enterprises');
  }

  return (
    <AppShell>
      <Caption>Step 3 of 6</Caption>
      <H2 style={{ marginTop: spacing.sm }}>{strings.farmOnboarding.title}</H2>
      <Body style={styles.lead}>{strings.farmOnboarding.body}</Body>

      <PrimaryButton label={locating ? 'Finding location...' : strings.farmOnboarding.useLocation} disabled={locating} onPress={() => void useCurrentLocation()} />
      {accuracyNote ? (
        <View style={styles.found}>
          <H3>{accuracyNote}</H3>
          <Caption style={{ marginTop: spacing.xs }}>{draft.farmLocation}</Caption>
        </View>
      ) : null}

      <Input
        label="Place name"
        value={draft.farmLocation ?? ''}
        onChangeText={(farmLocation) => setDraft((current) => ({ ...current, farmLocation, addLocationLater: false }))}
        placeholder="Village, ward or market centre"
      />
      <Input label={strings.farmOnboarding.name} value={draft.farmName ?? ''} onChangeText={(farmName) => setDraft((current) => ({ ...current, farmName }))} placeholder="Home farm" />
      <Input label={`${strings.farmOnboarding.area} (acres)`} value={draft.reportedArea ?? ''} keyboardType="decimal-pad" onChangeText={(reportedArea) => setDraft((current) => ({ ...current, reportedArea }))} placeholder="2.5" />

      <Caption style={styles.label}>{strings.farmOnboarding.tenure}</Caption>
      <View style={styles.chips}>
        {tenures.map((item) => (
          <Pressable key={item.id} onPress={() => setDraft((current) => ({ ...current, tenure: item.id }))} style={[styles.chip, draft.tenure === item.id && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: draft.tenure === item.id }}>
            <Text style={[styles.chipText, draft.tenure === item.id && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <PrimaryButton label="Continue" onPress={() => void continueNext(false)} />
      <Pressable accessibilityRole="button" onPress={() => void continueNext(true)} style={styles.later}>
        <Text style={styles.laterText}>{strings.farmOnboarding.later}</Text>
      </Pressable>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  found: { marginVertical: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  label: { color: colors.ink, fontWeight: '800', marginBottom: spacing.sm },
  chips: { gap: spacing.sm, marginBottom: spacing.xl },
  chip: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.lg },
  chipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  chipTextActive: { color: '#fff' },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md },
  later: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  laterText: { color: colors.info, fontWeight: '800', fontSize: 16 }
});
