import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, H1 } from '@/components/Typography';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { strings } from '@/constants/strings';
import { colors, spacing } from '@/constants/theme';

export default function Welcome() {
  async function start(intent: 'new' | 'returning') {
    await FarmerAppService.setOnboardingIntent(intent);
    router.push({ pathname: '/(auth)/phone', params: { intent } });
  }

  return (
    <AppShell contentStyle={styles.container}>
      <View style={styles.mark} accessibilityElementsHidden />
      <H1>{strings.welcome.line1}</H1>
      <H1>{strings.welcome.line2}</H1>
      <H1>{strings.welcome.line3}</H1>
      <Body style={styles.support}>{strings.welcome.support}</Body>
      <View style={styles.actions}>
        <PrimaryButton label={strings.welcome.start} onPress={() => void start('new')} />
        <PrimaryButton label={strings.welcome.signIn} variant="secondary" onPress={() => void start('returning')} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-end', paddingBottom: spacing.xxxl },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandSoft,
    borderWidth: 8,
    borderColor: colors.brand,
    marginBottom: spacing.xxxl
  },
  support: { marginTop: spacing.xl, color: colors.muted, maxWidth: 340 },
  actions: { marginTop: spacing.xxxl, gap: spacing.md }
});
