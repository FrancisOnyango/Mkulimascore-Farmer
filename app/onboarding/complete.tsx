import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1, H3 } from '@/components/Typography';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { BrandMark } from '@/components/BrandMark';
import { colors, radius, spacing } from '@/constants/theme';

export default function OnboardingComplete() {
  const { refresh, passport, farms, enterprises, consents } = useAppData();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  const pendingLink = consents.find((item) => item.status === 'pending');

  return (
    <AppShell contentStyle={styles.container}>
      <BrandMark size={56} />
      <Caption style={{ marginTop: spacing.md }}>Mkulima Passport</Caption>
      <H1 style={{ marginTop: spacing.sm }}>Your Mkulima Passport is ready.</H1>
      <Body style={styles.lead}>You can keep improving your profile as your farm changes.</Body>
      <View style={styles.list}>
        <Done label="Farmer identity established" detail={passport?.displayName || 'Saved'} />
        <Done label={farms[0] ? 'Farm added' : 'Farm can be added later'} detail={farms[0]?.name ?? 'Add when you are ready'} />
        {enterprises.map((enterprise) => (
          <Done key={enterprise.id} label={`${enterprise.sector} enterprise added`} detail={enterprise.summary} />
        ))}
        {pendingLink ? <Done label="Cooperative connection pending" detail={pendingLink.institution} /> : null}
      </View>
      <PrimaryButton
        label="Go to my farm"
        disabled={!ready}
        onPress={() => router.replace('/(tabs)/home')}
      />
    </AppShell>
  );
}

function Done({ label, detail }: { label: string; detail: string }) {
  return (
    <View style={styles.item}>
      <H3>{label}</H3>
      <Caption style={{ marginTop: 4 }}>{detail}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-end', paddingBottom: spacing.xxxl },
  lead: { marginTop: spacing.lg, color: colors.muted },
  list: { marginVertical: spacing.xxl, gap: spacing.md },
  item: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }
});
