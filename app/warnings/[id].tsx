import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AlertCard } from '@/components/AlertCard';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { loadFarmEarlyWarnings } from '@/lib/warnings/load';
import { levelLabel } from '@/lib/warnings/engine';
import { colors, radius, spacing } from '@/constants/theme';
import type { FarmerAlert, ImpactCase } from '@/domain/warnings';

export default function EarlyWarningDetail() {
  const params = useLocalSearchParams<{ id?: string; alertId?: string; farmId?: string }>();
  const alertId = params.id ?? params.alertId;
  const { farms, enterprises, weather, settings, refresh, selectedFarmId } = useAppData();
  const farm = farms.find((item) => item.id === (params.farmId || selectedFarmId)) ?? farms[0];
  const farmWeather = weather.find((item) => item.farmId === farm?.id);
  const [alerts, setAlerts] = useState<FarmerAlert[]>([]);
  const [impactType, setImpactType] = useState<ImpactCase['impactType']>('crop');
  const [narrative, setNarrative] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!farm) {
      setAlerts([]);
      return;
    }
    void loadFarmEarlyWarnings({
      farm,
      enterprises: enterprises.filter((item) => item.farmId === farm.id),
      weather: farmWeather,
      language: settings.language
    }).then(setAlerts);
  }, [farm?.id, farmWeather?.id, enterprises, settings.language, farm?.exposure?.notedAt]);

  const alert = useMemo(
    () => alerts.find((item) => item.id === alertId) ?? alerts[0],
    [alertId, alerts]
  );

  if (!farm) {
    return (
      <AppShell>
        <H2>Early warning</H2>
        <Body style={{ marginTop: spacing.md, color: colors.muted }}>Add a farm first to see preparedness watches.</Body>
        <PrimaryButton label="My Farm" onPress={() => router.replace('/(tabs)/farm')} />
      </AppShell>
    );
  }

  if (!alert) {
    return (
      <AppShell>
        <H2>Early warning</H2>
        <Body style={{ marginTop: spacing.md, color: colors.muted }}>No active preparedness watch for this farm right now.</Body>
        <PrimaryButton label="Back to weather" onPress={() => router.replace('/insights/weather')} />
      </AppShell>
    );
  }

  async function ack() {
    if (!alert || !farm) return;
    await FarmerAppService.acknowledgeWarning(alert.id, alert.actions[0]?.id);
    const next = await loadFarmEarlyWarnings({
      farm,
      enterprises: enterprises.filter((item) => item.farmId === farm.id),
      weather: farmWeather,
      language: settings.language
    });
    setAlerts(next);
    await refresh();
    Alert.alert('Noted', 'We recorded that you saw this watch. Stay safe.');
  }

  async function reportImpact() {
    if (!alert || !farm) return;
    if (!narrative.trim()) {
      Alert.alert('Add a short note', 'Say what was affected only when you are safe.');
      return;
    }
    setSaving(true);
    try {
      await FarmerAppService.reportWarningImpact({
        alertId: alert.id,
        farmId: farm.id,
        impactType,
        narrative: narrative.trim(),
        safeToAssess: true
      });
      await refresh();
      Alert.alert('Saved as provisional', 'Impact is added by you until a field visit or partner confirms it.');
      router.back();
    } catch {
      Alert.alert('Could not save', 'Try again when you have a signal. Your note stays on this phone if queued.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <Caption>Early warning</Caption>
      <H2 style={{ marginTop: spacing.xs }}>{alert.title}</H2>
      <AlertCard alert={alert} onAck={alert.status === 'active' ? () => void ack() : undefined} />

      <Card style={styles.plan}>
        <Caption>Protective plan · {levelLabel(alert.level, settings.language)}</Caption>
        <H3 style={{ marginTop: spacing.xs }}>What to do</H3>
        {alert.actions.map((action) => (
          <View key={action.id} style={styles.actionRow}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{action.label}</Text>
              <Text style={styles.actionDetail}>{action.detail}</Text>
            </View>
          </View>
        ))}
        <Caption style={{ marginTop: spacing.md }}>{alert.sourceLabel}</Caption>
      </Card>

      <Card style={styles.impact}>
        <Caption>After the event · only when safe</Caption>
        <H3 style={{ marginTop: spacing.xs }}>Safety-first check-in</H3>
        <Body style={{ marginTop: spacing.sm, color: colors.muted }}>
          Tell us if the farm, animals, harvest, store or road was affected. This opens a provisional impact case — not an automatic verified loss.
        </Body>
        <View style={styles.chips}>
          {([
            ['crop', 'Crop'],
            ['livestock', 'Livestock'],
            ['storage', 'Storage'],
            ['access', 'Access road'],
            ['infrastructure', 'Infrastructure'],
            ['other', 'Other']
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setImpactType(id)}
              style={[styles.chip, impactType === id && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: impactType === id }}
            >
              <Text style={[styles.chipText, impactType === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Input
          label="What happened?"
          value={narrative}
          onChangeText={setNarrative}
          placeholder="Short note from a safe place"
          multiline
        />
        <PrimaryButton label={saving ? 'Saving...' : 'Save provisional impact'} disabled={saving} onPress={() => void reportImpact()} />
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  plan: { marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
  actionTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  actionDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  impact: { marginTop: spacing.md, marginBottom: spacing.xxl, backgroundColor: colors.warm, borderColor: '#F0DFB0' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  chip: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: spacing.md, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  chipTextOn: { color: '#fff' }
});
