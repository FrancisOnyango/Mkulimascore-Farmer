import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthShell } from '@/components/AuthShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { createAuthService } from '@/lib/auth/AuthService';
import { formatKenyaPhoneInput, isPlausibleKenyaPhone } from '@/lib/phone/kenya';
import { colors, radius, spacing } from '@/constants/theme';
import { TRIAL_PHONE, TRIAL_PHONE_DISPLAY, trialAccessEnabled } from '@/lib/auth/trialCredentials';

export default function Phone() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  const returning = intent === 'returning';
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(value = phone) {
    const next = value.trim();
    if (!isPlausibleKenyaPhone(next)) {
      setError('Enter a Kenyan mobile number, starting with 07.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await createAuthService().requestOtp(next);
      router.push({
        pathname: '/(auth)/otp',
        params: { challengeId: result.challengeId, intent, phone: next }
      });
    } catch {
      setError('We could not continue. Check the number and try again when you have a signal.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell
      footer={
        <PrimaryButton
          label={sending ? 'Continuing...' : returning ? 'Send sign-in code' : 'Send code'}
          disabled={phone.replace(/\D/g, '').length < 9 || sending}
          onPress={() => void sendCode()}
        />
      }
    >
      <Caption>{returning ? 'Welcome back' : 'New Passport'}</Caption>
      <H2 style={{ marginTop: spacing.sm }}>{returning ? 'Sign in with your phone' : 'Your phone number'}</H2>
      <Body style={styles.help}>
        {returning
          ? 'Use the Kenyan number on your Passport. The code stays on this phone if the network is slow.'
          : 'This number stays with your Passport if you reinstall the app. We only send a one-time code.'}
      </Body>
      <View style={styles.phoneRow}>
        <View style={styles.country}>
          <Text style={styles.countryHint}>Kenya</Text>
          <Text style={styles.countryText}>+254</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Input
            value={phone}
            onChangeText={(value) => {
              setPhone(formatKenyaPhoneInput(value));
              if (error) setError(null);
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="07xx xxx xxx"
            maxLength={12}
            error={error}
            accessibilityLabel="Kenyan mobile number"
          />
        </View>
      </View>
      {trialAccessEnabled() ? (
        <Pressable
          onPress={() => {
            setPhone(formatKenyaPhoneInput(TRIAL_PHONE));
            void sendCode(TRIAL_PHONE);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Use trial number ${TRIAL_PHONE_DISPLAY}`}
          style={styles.trial}
        >
          <Text style={styles.trialLabel}>Use trial number</Text>
          <Text style={styles.trialValue}>{TRIAL_PHONE_DISPLAY}</Text>
        </Pressable>
      ) : null}
    </AuthShell>
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
  countryHint: { color: colors.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  countryText: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  trial: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center'
  },
  trialLabel: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  trialValue: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 2 }
});
