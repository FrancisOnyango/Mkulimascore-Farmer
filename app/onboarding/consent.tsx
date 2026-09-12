import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { BrandMark } from '@/components/BrandMark';
import { strings } from '@/constants/strings';
import { FARMER_CONSENT_VERSION, type OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

export default function Consent() {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => setDraft(session.draft ?? { intent: 'new', step: 'consent' }));
  }, []);

  async function accept() {
    if (!draft) return;
    const next: OnboardingDraft = {
      ...draft,
      step: 'identity',
      consentVersion: FARMER_CONSENT_VERSION,
      consentAcceptedAt: new Date().toISOString()
    };
    await FarmerAppService.saveOnboardingDraft(next);
    router.replace('/onboarding/identity');
  }

  return (
    <AppShell>
      <BrandMark size={48} />
      <Caption style={{ marginTop: spacing.md }}>Step 1 of 6</Caption>
      <H2 style={{ marginTop: spacing.sm }}>{strings.consent.title}</H2>
      <Body style={styles.lead}>{strings.consent.body}</Body>
      <View style={styles.points}>
        <Point title="What we collect" detail={strings.consent.collected} />
        <Point title="Why" detail={strings.consent.why} />
        <Point title="Who may see it" detail={strings.consent.who} />
        <Point title="You stay in control" detail={strings.consent.manage} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert('Mkulima Passport terms', `${strings.help.passportAnswer}\n\n${strings.help.whoAnswer}\n\n${strings.disclaimer}\n\n${strings.consent.versionLabel}: ${FARMER_CONSENT_VERSION}`)}
        style={styles.learn}
      >
        <Text style={styles.learnText}>{strings.consent.learnMore}</Text>
      </Pressable>
      <PrimaryButton label={strings.consent.accept} onPress={() => void accept()} />
    </AppShell>
  );
}

function Point({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.point}>
      <Caption style={styles.pointTitle}>{title}</Caption>
      <Body>{detail}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.md, marginBottom: spacing.xl, color: colors.muted },
  points: { gap: spacing.lg, marginBottom: spacing.xl },
  point: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  pointTitle: { color: colors.brand, fontWeight: '800', marginBottom: spacing.xs },
  learn: { minHeight: 48, justifyContent: 'center', marginBottom: spacing.lg },
  learnText: { color: colors.info, fontWeight: '800', fontSize: 16 }
});
