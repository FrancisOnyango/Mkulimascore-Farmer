import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { ENTERPRISE_CATALOG } from '@/lib/onboarding/enterprises';
import { VALUE_CHAIN_GROUPS } from '@/lib/onboarding/valueChains';
import type { FarmSector, OnboardingDraft } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

export default function Enterprises() {
  const { refresh } = useAppData();
  const [draft, setDraft] = useState<OnboardingDraft>({ intent: 'new', step: 'enterprises', sectors: [] });
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<(typeof VALUE_CHAIN_GROUPS)[number]['id']>('all');
  const [error, setError] = useState<string | null>(null);
  const selected = draft.sectors ?? [];
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ENTERPRISE_CATALOG.filter((item) => {
      const inGroup = group === 'all' || item.group === group;
      const inSearch = !needle || item.label.toLowerCase().includes(needle) || item.hint.toLowerCase().includes(needle);
      return inGroup && inSearch;
    });
  }, [group, query]);

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
    const next: OnboardingDraft = { ...draft, step: 'complete', institutionChoice: 'later' };
    await FarmerAppService.completeSelfOnboarding(next);
    await refresh();
    router.replace('/onboarding/complete');
  }

  return (
    <AppShell>
      <Caption>Step 3 of 3</Caption>
      <H2 style={{ marginTop: spacing.sm }}>What do you farm?</H2>
      <Body style={styles.lead}>Kenya’s main value chains. Choose what is on this farm now.</Body>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search maize, dairy, tea, ndengu..."
        accessibilityLabel="Search enterprises"
        autoComplete="off"
        hint={selected.length ? `${selected.length} selected` : 'You can select more than one.'}
      />
      <View style={styles.groups}>
        {VALUE_CHAIN_GROUPS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setGroup(item.id)}
            style={[styles.group, group === item.id && styles.groupOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: group === item.id }}
          >
            <Text style={[styles.groupText, group === item.id && styles.groupTextOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
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
              <Ionicons name={item.icon} size={22} color={active ? '#fff' : colors.brandDark} />
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
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  group: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  groupOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  groupText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  groupTextOn: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  tile: { width: '48%', minHeight: 104, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md, justifyContent: 'space-between' },
  tileActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  tileTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: spacing.sm },
  tileTitleActive: { color: '#fff' },
  tileHint: { color: colors.muted, fontSize: 12 },
  tileHintActive: { color: '#D8E8DE' },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md }
});
