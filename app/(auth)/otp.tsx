import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { createAuthService } from '@/lib/auth/AuthService';
import { routeForStep } from '@/lib/onboarding/routes';
import { colors, spacing } from '@/constants/theme';

export default function Otp() {
  const params = useLocalSearchParams<{ challengeId?: string; intent?: string; phone?: string; accountLogin?: string }>();
  const challengeId = first(params.challengeId) ?? 'demo-otp-challenge';
  const intent = first(params.intent);
  const phone = first(params.phone) ?? '';
  const accountLogin = first(params.accountLogin) === '1';
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      await createAuthService().verifyOtp(challengeId, code);
      if (intent === 'new') {
        const draft = await FarmerAppService.beginSelfOnboarding(phone);
        router.replace(routeForStep(draft.step));
        return;
      }
      await FarmerAppService.markReturningSession();
      router.replace('/(tabs)/home');
    } catch {
      setError(accountLogin ? 'Check the password and try again.' : 'That code did not work. Wait a moment and try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AppShell>
      <H2>{accountLogin ? 'Enter your password' : 'Enter the code'}</H2>
      <Body style={styles.help}>
        {accountLogin
          ? 'This signs you back into your existing profile.'
          : phone ? `We sent a code to ${phone}. It may take a moment on a slow network.` : 'Enter the 4 to 6 digit code.'}
      </Body>
      <Input
        value={code}
        onChangeText={setCode}
        keyboardType={accountLogin ? 'default' : 'number-pad'}
        maxLength={accountLogin ? undefined : 6}
        secureTextEntry={accountLogin}
        autoComplete={accountLogin ? 'password' : 'one-time-code'}
        textContentType={accountLogin ? 'password' : 'oneTimeCode'}
        placeholder={accountLogin ? 'Password' : '000000'}
        error={error}
        style={accountLogin ? undefined : styles.otp}
      />
      <PrimaryButton label={verifying ? 'Checking...' : 'Continue'} disabled={code.length < 4 || verifying} onPress={() => void verify()} />
    </AppShell>
  );
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  help: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  otp: { fontSize: 28, letterSpacing: 8, minHeight: 64, textAlign: 'center' }
});
