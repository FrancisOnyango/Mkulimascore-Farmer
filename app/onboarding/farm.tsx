import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { SuggestInput } from '@/components/SuggestInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { farmNameSuggestions } from '@/lib/onboarding/valueChains';
import { FarmerAppService } from '@/application/FarmerAppService';
import { strings } from '@/constants/strings';
import type { Farm, FarmTenure, OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

const tenures: { id: FarmTenure; label: string }[] = [
  { id: 'owned', label: 'I own this land' },
  { id: 'family', label: 'Family land' },
  { id: 'leased', label: 'Leased' },
  { id: 'other', label: 'Other arrangement' }
];

export default function FarmOnboarding() {
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'farm', areaUnit: 'acres' });
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(false);
  const [accuracyNote, setAccuracyNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => {
      if (session.draft) setDraft({ areaUnit: 'acres', ...session.draft, step: 'farm' });
    });
  }, []);

  const placed = draft.latitude != null && draft.longitude != null;
  const previewFarm = placed ? draftFarm(draft) : null;

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setManual(true);
        setError('Location permission is needed only if you want us to find the farm. You can type a place instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const accuracy = position.coords.accuracy ?? 999;
      const [place] = await Location.reverseGeocodeAsync(position.coords).catch(() => []);
      const placeName = [place?.name, place?.subregion, place?.city].filter(Boolean).join(', ');
      const county = place?.region || place?.subregion || draft.county;
      setDraft((current) => ({
        ...current,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        farmLocation: placeName || current.farmLocation || county,
        county: county || current.county,
        addLocationLater: false
      }));
      setAccuracyNote(accuracy > 80 ? 'GPS is not very precise here. You can still confirm this as an approximate place.' : strings.farmOnboarding.found);
      setManual(false);
    } catch {
      setManual(true);
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
      <Caption>Step 2 of 3</Caption>
      <H2 style={{ marginTop: spacing.sm }}>Where is your farm?</H2>
      <Body style={styles.lead}>{strings.farmOnboarding.body}</Body>

      <PrimaryButton label={locating ? 'Finding location...' : strings.farmOnboarding.useLocation} disabled={locating} onPress={() => void useCurrentLocation()} />

      {previewFarm ? (
        <View style={styles.mapWrap}>
          <FarmPlaceMap farm={previewFarm} height={220} interactive={false} showZoom={false} basemap="satellite" />
          <View style={styles.found}>
            <H3>{accuracyNote || strings.farmOnboarding.found}</H3>
            <Caption style={{ marginTop: spacing.xs }}>{[draft.farmLocation, draft.county].filter(Boolean).join(' · ')}</Caption>
          </View>
        </View>
      ) : null}

      {manual || !placed ? (
        <Pressable onPress={() => setManual(true)} accessibilityRole="button" style={styles.later}>
          <Text style={styles.laterText}>{manual ? 'Type the place below' : 'Enter location manually'}</Text>
        </Pressable>
      ) : null}

      {manual || placed ? (
        <>
          <Input
            label="Place name"
            value={draft.farmLocation ?? ''}
            onChangeText={(farmLocation) => setDraft((current) => ({ ...current, farmLocation, addLocationLater: false }))}
            placeholder="Village, ward or market centre"
            hint={draft.county ? `In ${draft.county}, if that is right.` : 'Village, ward or the nearest market.'}
          />
          <SuggestInput
            label={strings.farmOnboarding.name}
            value={draft.farmName ?? ''}
            onChangeText={(farmName) => setDraft((current) => ({ ...current, farmName }))}
            placeholder="Home farm"
            suggestions={farmNameSuggestions()}
          />
          <Input
            label={strings.farmOnboarding.area}
            value={draft.reportedArea ?? ''}
            keyboardType="decimal-pad"
            onChangeText={(reportedArea) => setDraft((current) => ({ ...current, reportedArea }))}
            placeholder="2.5"
            hint="Your own estimate is enough. A walk can measure later."
          />
          <View style={styles.units}>
            {(['acres', 'hectares'] as const).map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setDraft((current) => ({ ...current, areaUnit: unit }))}
                style={[styles.unit, (draft.areaUnit ?? 'acres') === unit && styles.unitOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: (draft.areaUnit ?? 'acres') === unit }}
              >
                <Text style={[styles.unitText, (draft.areaUnit ?? 'acres') === unit && styles.unitTextOn]}>
                  {unit === 'acres' ? 'Acres' : 'Hectares'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Caption style={styles.label}>{strings.farmOnboarding.tenure}</Caption>
          <View style={styles.chips}>
            {tenures.map((item) => (
              <Pressable key={item.id} onPress={() => setDraft((current) => ({ ...current, tenure: item.id }))} style={[styles.chip, draft.tenure === item.id && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: draft.tenure === item.id }}>
                <Text style={[styles.chipText, draft.tenure === item.id && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <PrimaryButton label={placed ? 'Confirm farm location' : 'Continue'} onPress={() => void continueNext(false)} />
      <Pressable accessibilityRole="button" onPress={() => void continueNext(true)} style={styles.later}>
        <Text style={styles.laterText}>{strings.farmOnboarding.later}</Text>
      </Pressable>
    </AppShell>
  );
}

function draftFarm(draft: OnboardingDraft): Farm {
  return {
    id: 'onboarding-preview',
    name: draft.farmName?.trim() || 'Your farm',
    location: [draft.farmLocation, draft.county].filter(Boolean).join(', ') || 'Farm place',
    latitude: draft.latitude,
    longitude: draft.longitude,
    reportedArea: Number(draft.reportedArea) || 0,
    measuredArea: null,
    areaUnit: draft.areaUnit === 'hectares' ? 'hectares' : 'acres',
    mapped: false,
    verification: 'reported',
    enterprises: []
  };
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  mapWrap: { marginTop: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  found: { padding: spacing.lg },
  label: { color: colors.ink, fontWeight: '800', marginBottom: spacing.sm },
  units: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  unit: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  unitOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  unitText: { color: colors.ink, fontWeight: '800' },
  unitTextOn: { color: '#fff' },
  chips: { gap: spacing.sm, marginBottom: spacing.xl },
  chip: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.lg },
  chipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  chipTextActive: { color: '#fff' },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md },
  later: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  laterText: { color: colors.info, fontWeight: '800', fontSize: 16 }
});
