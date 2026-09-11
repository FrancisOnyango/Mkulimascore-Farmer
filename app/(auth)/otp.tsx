import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthShell } from '@/components/AuthShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { createAuthService } from '@/lib/auth/AuthService';
import { routeForStep } from '@/lib/onboarding/routes';
import { colors, spacing } from '@/constants/theme';
import { digitsOnly } from '@/lib/phone/kenya';
import { isTrialPhone, TRIAL_OTP, trialAccessEnabled } from '@/lib/auth/trialCredentials';

export default function Otp() {
  const params = useLocalSearchParams<{ challengeId?: string; intent?: string; phone?: string }>();
  const challengeId = first(params.challengeId) ?? 'demo-otp-challenge';
  const intent = first(params.intent);
  const phone = first(params.phone) ?? '';
  const { refresh } = useAppData();
  const trial = isTrialPhone(phone);
  const [code, setCode] = useState(trial ? TRIAL_OTP : '');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(nextCode = code) {
    setVerifying(true);
    setError(null);
    try {
      await createAuthService().verifyOtp(challengeId, digitsOnly(nextCode));
      if (intent === 'new') {
        const draft = await FarmerAppService.beginSelfOnboarding(phone);
        await refresh();
        router.replace(routeForStep(draft.step));
        return;
      }
      if (trial) await FarmerAppService.restoreSampleFarm();
      else await FarmerAppService.markReturningSession();
      await refresh();
      router.replace('/(tabs)/home');
    } catch {
      setError('That code did not work. Check the 6 digits and try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthShell
      footer={
        <PrimaryButton
          label={verifying ? 'Checking...' : 'Continue'}
          disabled={digitsOnly(code).length < 6 || verifying}
          onPress={() => void verify()}
        />
      }
    >
      <Caption>{trial ? 'Trial access' : 'One-time code'}</Caption>
      <H2 style={{ marginTop: spacing.sm }}>{trial ? 'Enter the trial code' : 'Enter the code'}</H2>
      <Body style={styles.help}>
        {trial
          ? `Use ${TRIAL_OTP} for ${phone}. No SMS is sent for the sample farm.`
          : phone
            ? `Enter the 6-digit code sent to ${phone}. On a slow network it can take a minute.`
            : 'Enter the 6-digit code.'}
      </Body>
      <Input
        value={code}
        onChangeText={(value) => {
          setCode(digitsOnly(value).slice(0, 6));
          if (error) setError(null);
        }}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        placeholder="000000"
        error={error}
        accessibilityLabel="One-time code"
        style={styles.otp}
      />
      {trialAccessEnabled() && trial ? (
        <Pressable
          onPress={() => {
            setCode(TRIAL_OTP);
            void verify(TRIAL_OTP);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Use trial code ${TRIAL_OTP}`}
          style={styles.fill}
        >
          <Text style={styles.fillText}>Use trial code {TRIAL_OTP}</Text>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  help: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  otp: { fontSize: 28, letterSpacing: 10, minHeight: 68, textAlign: 'center', fontWeight: '800' },
  fill: { minHeight: 48, justifyContent: 'center' },
  fillText: { color: colors.brandDark, fontSize: 15, fontWeight: '800' }
});
