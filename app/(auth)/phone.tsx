import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { createAuthService } from '@/lib/auth/AuthService';
import { isPlausibleKenyaPhone } from '@/lib/phone/kenya';
import { colors, radius, spacing } from '@/constants/theme';

export default function Phone() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  const liveAccountLogin = (process.env.EXPO_PUBLIC_APP_MODE ?? 'demo') !== 'demo';
  const [phone, setPhone] = useState('');
  const [accountLogin, setAccountLogin] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useAccount = liveAccountLogin && accountLogin;

  async function sendCode() {
    const value = phone.trim();
    if (!useAccount && !isPlausibleKenyaPhone(value)) {
      setError('Enter a Kenyan mobile number, starting with 07.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await createAuthService().requestOtp(value);
      router.push({ pathname: '/(auth)/otp', params: { challengeId: result.challengeId, intent, phone: value, accountLogin: useAccount ? '1' : '0' } });
    } catch {
      setError('We could not continue. Check the number and try again when you have a signal.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <Caption>Kenya · +254</Caption>
      <H2 style={{ marginTop: spacing.sm }}>{useAccount ? 'Sign in to your account' : 'Your phone number'}</H2>
      <Body style={styles.help}>
        {useAccount
          ? 'Use the account already linked to your Mkulima profile.'
          : 'We will send a one-time code. This phone stays with your Passport if you reinstall the app.'}
      </Body>
      <View style={styles.phoneRow}>
        {!useAccount ? (
          <View style={styles.country}>
            <Text style={styles.countryText}>KE +254</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType={useAccount ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
            autoComplete={useAccount ? 'username' : 'tel'}
            textContentType={useAccount ? 'username' : 'telephoneNumber'}
            placeholder={useAccount ? 'Account email or username' : '07xx xxx xxx'}
            error={error}
          />
        </View>
      </View>
      <PrimaryButton
        label={sending ? 'Continuing...' : useAccount ? 'Continue' : 'Send code'}
        disabled={phone.trim().length < (useAccount ? 3 : 9) || sending}
        onPress={() => void sendCode()}
      />
      {liveAccountLogin ? (
        <Pressable onPress={() => setAccountLogin((value) => !value)} accessibilityRole="button" style={styles.alt}>
          <Text style={styles.altText}>{accountLogin ? 'Use phone number instead' : 'Use account login'}</Text>
        </Pressable>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  help: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted },
  phoneRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  country: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: 27
  },
  countryText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  alt: { minHeight: 48, justifyContent: 'center', marginTop: spacing.md },
  altText: { color: colors.info, fontWeight: '800', fontSize: 15 }
});
