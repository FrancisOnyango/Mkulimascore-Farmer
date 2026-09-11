import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Input, keyboardFor } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { enterpriseCatalog } from '@/lib/onboarding/enterprises';
import type { FarmSector, OnboardingDraft } from '@/domain/types';
import { colors, spacing } from '@/constants/theme';

export default function EnterpriseSetup() {
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'enterprise_setup', sectors: [], enterpriseDetails: {} });

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => {
      if (session.draft) setDraft({ ...session.draft, step: 'enterprise_setup', enterpriseDetails: session.draft.enterpriseDetails ?? {} });
    });
  }, []);

  function setField(sector: FarmSector, key: string, value: string) {
    setDraft((current) => ({
      ...current,
      enterpriseDetails: {
        ...current.enterpriseDetails,
        [sector]: { ...(current.enterpriseDetails?.[sector] ?? {}), [key]: value }
      }
    }));
  }

  async function continueNext() {
    const next: OnboardingDraft = { ...draft, step: 'institution' };
    await FarmerAppService.saveOnboardingDraft(next);
    router.replace('/onboarding/institution');
  }

  return (
    <AppShell>
      <Caption>Step 5 of 6</Caption>
      <H2 style={{ marginTop: spacing.sm }}>A few useful details</H2>
      <Body style={styles.lead}>Only what helps this enterprise make sense. Skip anything you do not know yet.</Body>
      {(draft.sectors ?? []).map((sector) => {
        const catalog = enterpriseCatalog(sector);
        if (!catalog) return null;
        return (
          <React.Fragment key={sector}>
            <H3 style={{ marginBottom: spacing.md }}>{catalog.label}</H3>
            {catalog.fields.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                keyboardType={keyboardFor(field.keyboard)}
                value={draft.enterpriseDetails?.[sector]?.[field.key] ?? ''}
                onChangeText={(value) => setField(sector, field.key, value)}
              />
            ))}
          </React.Fragment>
        );
      })}
      <PrimaryButton label="Continue" onPress={() => void continueNext()} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted }
});
