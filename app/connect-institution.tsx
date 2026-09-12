import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Input } from '@/components/Input';
import { SuggestInput } from '@/components/SuggestInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { institutionSuggestions } from '@/lib/onboarding/valueChains';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { colors, spacing } from '@/constants/theme';

export default function ConnectInstitution() {
  const { refresh } = useAppData();
  const [name, setName] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      Alert.alert('Institution name', 'Enter the SACCO or cooperative name.');
      return;
    }
    setSaving(true);
    try {
      await FarmerAppService.requestInstitutionLink(name.trim(), memberNumber.trim() || undefined);
      await refresh();
      Alert.alert('Connection pending', 'This stays pending until the institution confirms you.');
      router.back();
    } catch {
      Alert.alert('Could not save', 'Try again when you have a signal. Your Passport was not changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <H2>Connect a SACCO or cooperative</H2>
      <Body style={styles.lead}>This creates a request. It does not share your records until you allow it and they confirm you.</Body>
      <SuggestInput
        label="Institution name"
        value={name}
        onChangeText={setName}
        placeholder="Start typing the SACCO or cooperative"
        suggestions={institutionSuggestions()}
        autoCapitalize="words"
      />
      <Input label="Member number" value={memberNumber} onChangeText={setMemberNumber} placeholder="Optional" hint="Only if you already have one." autoComplete="off" />
      <PrimaryButton label={saving ? 'Saving...' : 'Send connection request'} disabled={saving} onPress={() => void save()} />
      <Caption style={{ marginTop: spacing.lg }}>Status will show as connection pending until confirmed.</Caption>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.muted }
});
