import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AuthShell } from '@/components/AuthShell';
import { Body, Caption } from '@/components/Typography';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { createAuthService } from '@/lib/auth/AuthService';
import { strings } from '@/constants/strings';
import { BrandMark } from '@/components/BrandMark';
import { colors, radius, spacing } from '@/constants/theme';
import {
  TRIAL_CHALLENGE_ID,
  TRIAL_OTP,
  TRIAL_PHONE,
  TRIAL_PHONE_DISPLAY,
  trialAccessEnabled
} from '@/lib/auth/trialCredentials';

export default function Welcome() {
  const { refresh } = useAppData();
  const [openingTrial, setOpeningTrial] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const showTrial = trialAccessEnabled();

  async function start(intent: 'new' | 'returning') {
    await FarmerAppService.setOnboardingIntent(intent);
    router.push({ pathname: '/(auth)/phone', params: { intent } });
  }

  async function openSampleFarm() {
    setOpeningTrial(true);
    setTrialError(null);
    try {
      await createAuthService().requestOtp(TRIAL_PHONE);
      await createAuthService().verifyOtp(TRIAL_CHALLENGE_ID, TRIAL_OTP);
      await FarmerAppService.restoreSampleFarm();
      await refresh();
      router.replace('/(tabs)/home');
    } catch {
      setTrialError('The sample farm could not open. Try again, or create a Passport with your own number.');
    } finally {
      setOpeningTrial(false);
    }
  }

  return (
    <AuthShell>
      <View style={styles.identity}>
        <BrandMark size={72} />
        <Text style={styles.kenya}>{strings.welcome.kenya}</Text>
        <Text style={styles.brand}>{strings.welcome.brand}</Text>
      </View>

      <Text style={styles.headline}>{strings.welcome.line1}</Text>
      <Text style={styles.headline}>{strings.welcome.line2}</Text>
      <Text style={styles.headline}>{strings.welcome.line3}</Text>
      <Body style={styles.support}>{strings.welcome.support}</Body>

      <View style={styles.benefits}>
        <Benefit label={strings.welcome.saved} />
        <Benefit label={strings.welcome.control} />
        <Benefit label={strings.welcome.noLoan} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={strings.welcome.start} onPress={() => void start('new')} />
        <PrimaryButton label={strings.welcome.signIn} variant="secondary" onPress={() => void start('returning')} />
      </View>

      {showTrial ? (
        <View style={styles.trial}>
          <Caption style={styles.trialEyebrow}>{strings.welcome.trialTitle}</Caption>
          <Text style={styles.trialBody}>{strings.welcome.trialBody}</Text>
          <View style={styles.creds}>
            <View style={styles.cred}>
              <Text style={styles.credLabel}>{strings.welcome.trialPhone}</Text>
              <Text style={styles.credValue}>{TRIAL_PHONE_DISPLAY}</Text>
            </View>
            <View style={styles.cred}>
              <Text style={styles.credLabel}>{strings.welcome.trialCode}</Text>
              <Text style={styles.credValue}>{TRIAL_OTP}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => void openSampleFarm()}
            disabled={openingTrial}
            accessibilityRole="button"
            accessibilityLabel={strings.welcome.trialAction}
            style={({ pressed }) => [styles.trialButton, pressed && { opacity: 0.85 }, openingTrial && { opacity: 0.5 }]}
          >
            <Text style={styles.trialButtonText}>{openingTrial ? 'Opening sample farm...' : strings.welcome.trialAction}</Text>
          </Pressable>
          {trialError ? <Text style={styles.trialError}>{trialError}</Text> : null}
        </View>
      ) : null}
    </AuthShell>
  );
}

function Benefit({ label }: { label: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitDot} />
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', marginBottom: spacing.xxl, marginTop: spacing.lg },
  kenya: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: spacing.md },
  brand: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '800', marginTop: 4 },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.ink },
  support: { marginTop: spacing.md, color: colors.muted, maxWidth: 360 },
  benefits: { marginTop: spacing.xl, gap: spacing.sm },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  benefitText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
  trial: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  trialEyebrow: { color: colors.brand, fontWeight: '800' },
  trialBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  creds: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cred: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  credLabel: { color: colors.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  credValue: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 4 },
  trialButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  trialButtonText: { color: colors.brandDark, fontSize: 15, fontWeight: '800' },
  trialError: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: spacing.sm }
});
