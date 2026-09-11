import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { ENTERPRISE_CATALOG } from '@/lib/onboarding/enterprises';
import type { FarmSector, OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

export default function Enterprises() {
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'enterprises', sectors: [] });
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selected = draft.sectors ?? [];
  const shown = useMemo(
    () => ENTERPRISE_CATALOG.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  useEffect(() => {
    void FarmerAppService.getSessionState().then((session) => {
      if (session.draft) setDraft({ ...session.draft, step: 'enterprises', sectors: session.draft.sectors ?? [] });
    });
  }, []);

  function toggle(sector: FarmSector) {
    setDraft((current) => {
      const sectors = current.sectors ?? [];
      return { ...current, sectors: sectors.includes(sector) ? sectors.filter((item) => item !== sector) : [...sectors, sector] };
    });
  }

  async function continueNext() {
    if (!selected.length) {
      setError('Choose at least one enterprise. You can add more later.');
      return;
    }
    const next: OnboardingDraft = { ...draft, step: 'enterprise_setup' };
    await FarmerAppService.saveOnboardingDraft(next);
    router.replace('/onboarding/setup');
  }

  return (
    <AppShell>
      <Caption>Step 4 of 6</Caption>
      <H2 style={{ marginTop: spacing.sm }}>What do you farm?</H2>
      <Body style={styles.lead}>Choose the enterprises that matter now. You can select more than one.</Body>
      <Input value={query} onChangeText={setQuery} placeholder="Search dairy, maize, tea..." accessibilityLabel="Search enterprises" />
      <View style={styles.grid}>
        {shown.map((item) => {
          const active = selected.includes(item.sector);
          return (
            <Pressable
              key={item.sector}
              onPress={() => toggle(item.sector)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label}. ${item.hint}`}
              style={[styles.tile, active && styles.tileActive]}
            >
              <Ionicons name={item.icon} size={26} color={active ? '#fff' : colors.brandDark} />
              <Text style={[styles.tileTitle, active && styles.tileTitleActive]}>{item.label}</Text>
              <Text style={[styles.tileHint, active && styles.tileHintActive]}>{item.hint}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <PrimaryButton label={selected.length ? `Continue with ${selected.length}` : 'Continue'} onPress={() => void continueNext()} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.lg, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  tile: { width: '48%', minHeight: 112, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md, justifyContent: 'space-between' },
  tileActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  tileTitle: { color: colors.ink, fontWeight: '800', fontSize: 17, marginTop: spacing.sm },
  tileTitleActive: { color: '#fff' },
  tileHint: { color: colors.muted, fontSize: 13 },
  tileHintActive: { color: '#D8E8DE' },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md }
});
