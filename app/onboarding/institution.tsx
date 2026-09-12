import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { SuggestInput } from '@/components/SuggestInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { institutionSuggestions } from '@/lib/onboarding/valueChains';
import { FarmerAppService } from '@/application/FarmerAppService';
import type { OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

const choices = [
  { id: 'yes' as const, label: 'Yes' },
  { id: 'no' as const, label: 'Not currently' },
  { id: 'later' as const, label: "I'll add this later" }
];

export default function Institution() {
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'institution' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => {
      if (session.draft) setDraft({ ...session.draft, step: 'institution' });
    });
  }, []);

  async function finish() {
    if (!draft.institutionChoice) {
      setError('Choose one option to continue.');
      return;
    }
    if (draft.institutionChoice === 'yes' && !draft.institutionName?.trim()) {
      setError('Enter the SACCO or cooperative name.');
      return;
    }
    const next: OnboardingDraft = { ...draft, step: 'complete' };
    await FarmerAppService.saveOnboardingDraft(next);
    await FarmerAppService.completeSelfOnboarding(next);
    router.replace('/onboarding/complete');
  }

  return (
    <AppShell>
      <Caption>Step 6 of 6</Caption>
      <H2 style={{ marginTop: spacing.sm }}>Are you a member of a SACCO or cooperative?</H2>
      <Body style={styles.lead}>Connecting does not share your records automatically. It only creates a request.</Body>
      <View style={styles.choices}>
        {choices.map((choice) => (
          <Pressable
            key={choice.id}
            onPress={() => setDraft((current) => ({ ...current, institutionChoice: choice.id }))}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.institutionChoice === choice.id }}
            style={[styles.choice, draft.institutionChoice === choice.id && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, draft.institutionChoice === choice.id && styles.choiceTextActive]}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
      {draft.institutionChoice === 'yes' ? (
        <>
          <SuggestInput
            label="Institution name"
            value={draft.institutionName ?? ''}
            onChangeText={(institutionName) => setDraft((current) => ({ ...current, institutionName }))}
            placeholder="Start typing the SACCO or cooperative"
            suggestions={institutionSuggestions()}
            autoCapitalize="words"
          />
          <Input
            label="Member number"
            value={draft.memberNumber ?? ''}
            onChangeText={(memberNumber) => setDraft((current) => ({ ...current, memberNumber }))}
            placeholder="Optional"
            hint="Only if you already have one."
            autoComplete="off"
          />
          <Caption>Connection stays pending until the institution confirms you.</Caption>
        </>
      ) : null}
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Finish" onPress={() => void finish()} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  choices: { gap: spacing.sm, marginBottom: spacing.xl },
  choice: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.lg },
  choiceActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  choiceText: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  choiceTextActive: { color: '#fff' },
  error: { color: colors.danger, fontWeight: '700', marginTop: spacing.md }
});
