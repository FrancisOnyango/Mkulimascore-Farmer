import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { getDeviceFix } from '@/lib/geo/deviceLocation';
import { farmOrigin } from '@/lib/markets/linkage';
import { PLACE_CATEGORIES, placeTypeChoices, type PlaceCategory } from '@/domain/places';
import { colors, radius, spacing } from '@/constants/theme';

export default function AddPlace() {
  const { farmId, category } = useLocalSearchParams<{ farmId?: string; category?: string }>();
  const { farms, enterprises, refresh } = useAppData();
  const farm = farms.find((item) => item.id === farmId) ?? farms[0];
  const origin = farm ? farmOrigin(farm) : null;
  const defaultCategory = PLACE_CATEGORIES.includes(category as PlaceCategory) ? category as PlaceCategory : 'inputs';
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaceCategory>(defaultCategory);
  const [phone, setPhone] = useState('');
  const [fix, setFix] = useState<{ latitude: number; longitude: number } | null>(origin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const types = useMemo(() => placeTypeChoices(), []);
  const commodity = enterprises.find((item) => item.farmId === farm?.id && item.primary)?.sector
    ?? enterprises.find((item) => item.farmId === farm?.id)?.sector;

  async function usePhoneGps() {
    const result = await getDeviceFix();
    if (!result.ok) {
      setError(result.reason === 'denied' ? 'Location permission is needed for the phone GPS.' : 'Phone GPS is not available.');
      return;
    }
    setFix({ latitude: result.fix.latitude, longitude: result.fix.longitude });
    setError(null);
  }

  async function save() {
    if (!name.trim()) return setError('Enter the place name.');
    if (!fix) return setError('Use the farm place or the phone GPS.');
    setSaving(true);
    setError(null);
    try {
      await FarmerAppService.submitPlace({
        name: name.trim(),
        category: kind,
        latitude: fix.latitude,
        longitude: fix.longitude,
        phone: phone.trim() || undefined,
        commodities: commodity ? [commodity] : [],
        services: kind === 'inputs' ? ['Farm supplies'] : [],
        farmId: farm?.id
      });
      await refresh();
      Alert.alert('Saved on this phone', 'Added by you. Not verified until a visit or more farmers confirm it.');
      router.back();
    } catch {
      setError('Could not save this place. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <H2>Add a place</H2>
      <Body style={styles.lead}>Short and honest. This stays added by you until someone confirms it.</Body>
      <Card style={{ marginTop: spacing.xl }}>
        <Input label="Place name" value={name} onChangeText={setName} placeholder="e.g. the agrovet you use" />
        <Caption style={styles.label}>Type</Caption>
        <View style={styles.chips}>
          {types.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setKind(item.id)}
              style={[styles.chip, kind === item.id && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === item.id }}
              accessibilityLabel={item.label}
            >
              <Text style={[styles.chipText, kind === item.id && styles.chipTextOn]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Caption style={{ marginTop: spacing.sm }}>{types.find((item) => item.id === kind)?.hint}</Caption>
        <Input
          label="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="07..."
        />
        <Caption style={styles.label}>Location</Caption>
        <Body>
          {fix
            ? `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`
            : 'No point yet'}
        </Body>
        <View style={styles.actions}>
          {origin ? (
            <PrimaryButton label="Use farm place" variant="secondary" onPress={() => setFix(origin)} />
          ) : null}
          <PrimaryButton label="Use phone GPS" variant="secondary" onPress={() => void usePhoneGps()} />
        </View>
        {error ? <Caption style={styles.error}>{error}</Caption> : null}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={saving ? 'Saving…' : 'Save place'} onPress={() => void save()} disabled={saving} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  label: { marginBottom: spacing.sm, fontWeight: '800', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.md }
});
