import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { KENYA_COUNTIES } from '@/lib/onboarding/counties';
import { strings } from '@/constants/strings';
import type { OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

export default function Identity() {
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'identity' });
  const [error, setError] = useState<string | null>(null);
  const [showCounties, setShowCounties] = useState(false);

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => {
      if (session.draft) setDraft({ ...session.draft, step: 'identity' });
    });
  }, []);

  async function continueNext() {
    if (!draft.displayName?.trim()) {
      setError('Enter the name this Passport should use.');
      return;
    }
    if (!draft.county) {
      setError('Choose your county.');
      return;
    }
    const next: OnboardingDraft = { ...draft, step: 'farm', language: draft.language ?? 'en' };
    await FarmerAppService.saveOnboardingDraft(next);
    router.replace('/onboarding/farm');
  }

  return (
    <AppShell>
      <Caption>Step 2 of 6</Caption>
      <H2 style={{ marginTop: spacing.sm }}>{strings.identity.title}</H2>
      <Body style={styles.lead}>{strings.identity.body}</Body>
      <Input
        label={strings.identity.name}
        value={draft.displayName ?? ''}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        autoCorrect={false}
        onChangeText={(displayName) => setDraft((current) => ({ ...current, displayName }))}
        placeholder="Francis Mwangi"
        hint="The name this Passport should use."
      />
      <Input
        label={strings.identity.county}
        value={draft.county ?? ''}
        onChangeText={(county) => {
          setDraft((current) => ({ ...current, county }));
          setShowCounties(true);
        }}
        placeholder="Start typing Nyeri, Kiambu..."
        autoComplete="off"
        hint="All 47 counties. Tap the match."
      />
      {showCounties ? (
        <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {KENYA_COUNTIES.filter((county) => !draft.county || county.toLowerCase().includes((draft.county ?? '').toLowerCase())).map((county) => (
            <Pressable
              key={county}
              accessibilityRole="button"
              onPress={() => {
                setDraft((current) => ({ ...current, county }));
                setShowCounties(false);
              }}
              style={styles.option}
            >
              <Text style={styles.optionText}>{county}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Input
        label={strings.identity.yearOfBirth}
        value={draft.yearOfBirth ?? ''}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={(yearOfBirth) => setDraft((current) => ({ ...current, yearOfBirth }))}
        placeholder="1984"
        hint="Year only. Optional, but useful."
      />
      <Input
        label={strings.identity.nationalId}
        value={draft.nationalId ?? ''}
        keyboardType="number-pad"
        autoComplete="off"
        onChangeText={(nationalId) => setDraft((current) => ({ ...current, nationalId }))}
        placeholder="Optional"
        hint="Stays on this phone unless you later share it."
      />
      <Caption style={{ marginBottom: spacing.sm }}>{strings.identity.language}</Caption>
      <View style={styles.langRow}>
        <Pressable
          onPress={() => setDraft((current) => ({ ...current, language: 'en' }))}
          style={[styles.lang, (draft.language ?? 'en') === 'en' && styles.langOn]}
        >
          <Text style={styles.langText}>English</Text>
        </Pressable>
        <Pressable
          onPress={() => setDraft((current) => ({ ...current, language: 'sw' }))}
          style={[styles.lang, draft.language === 'sw' && styles.langOn]}
        >
          <Text style={styles.langText}>Kiswahili</Text>
        </Pressable>
      </View>
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <PrimaryButton label={draft.language === 'sw' ? 'Endelea' : 'Continue'} onPress={() => void continueNext()} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  label: { color: colors.ink, fontWeight: '800', marginBottom: spacing.sm },
  select: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  selectText: { fontSize: 17, color: colors.ink, fontWeight: '700' },
  placeholder: { color: colors.faint, fontWeight: '500' },
  list: { maxHeight: 220, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.lg, overflow: 'hidden' },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { fontSize: 16, color: colors.ink },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  lang: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' },
  langOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  langText: { color: colors.brandDark, fontWeight: '800' }
});
