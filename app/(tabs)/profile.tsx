import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1 } from '@/components/Typography';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { createAuthService } from '@/lib/auth/AuthService';
import { consentStatusLabel } from '@/lib/copy/status';

export default function Profile() {
  const { passport, consents, settings } = useAppData();
  const [signingOut, setSigningOut] = useState(false);
  if (!passport) return <AppShell><Body>Loading profile...</Body></AppShell>;

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await createAuthService().signOut();
      router.replace('/(auth)/welcome');
    } catch {
      Alert.alert('Could not sign out', 'Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  const connected = consents.filter((item) => item.status === 'active' || item.status === 'pending');

  return (
    <AppShell>
      <Caption>Profile</Caption>
      <H1 style={{ marginTop: spacing.xs }}>{passport.displayName || 'Farmer'}</H1>
      <Caption style={{ marginTop: spacing.xs }}>{passport.phoneMasked}{passport.location ? ` · ${passport.location}` : ''}</Caption>

      <FarmerSection title="Mkulima Passport" action="Open" onAction={() => router.push('/passport')}>
        <FarmerRow value="Identity, farm and enterprises" label="Your agricultural profile" onPress={() => router.push('/passport')} last />
      </FarmerSection>

      <FarmerSection title="Data & permissions" detail="You control who can use your information.">
        {connected.length ? connected.map((item, index) => (
          <FarmerRow
            key={item.id}
            value={item.institution}
            label={item.purpose}
            status={consentStatusLabel(item.status)}
            tone={item.status === 'active' ? 'verified' : 'attention'}
            onPress={() => router.push('/consents')}
            last={false}
          />
        )) : (
          <FarmerRow value="No sharing yet" label="A SACCO or cooperative only sees what you choose to share." onPress={() => router.push('/consents')} />
        )}
        <FarmerRow value="Connect a cooperative" label="Create a membership request" onPress={() => router.push('/connect-institution')} last />
      </FarmerSection>

      <FarmerSection title="App">
        <FarmerRow value="Notifications" label="Weather and important updates only" onPress={() => router.push('/notifications')} />
        <FarmerRow value="Language" label={settings.language === 'sw' ? 'Kiswahili' : 'English'} onPress={() => router.push('/settings')} />
        <FarmerRow value="Saved updates" label="See what is still on this phone" onPress={() => router.push('/sync')} />
        <FarmerRow value="Records" label="Documents and evidence" onPress={() => router.push('/records')} last />
      </FarmerSection>

      <FarmerSection title="Help">
        <FarmerRow value="Ask about this farm" label="Explain weather, records or next steps from data on this phone" onPress={() => router.push('/ask')} />
        <FarmerRow value={strings.help.passport} label={strings.help.passportAnswer} />
        <FarmerRow value={strings.help.loan} label={strings.help.loanAnswer} />
        <FarmerRow value={strings.help.who} label={strings.help.whoAnswer} last />
      </FarmerSection>

      <Pressable onPress={() => void signOut()} disabled={signingOut} accessibilityRole="button" accessibilityLabel="Sign out" style={({ pressed }) => [styles.logout, pressed && { opacity: 0.82 }]}>
        <Text style={styles.logoutText}>{signingOut ? 'Signing out...' : 'Sign out'}</Text>
      </Pressable>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  logout: { minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 16 }
});
