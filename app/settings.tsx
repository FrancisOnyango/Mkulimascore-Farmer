import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View, Text, TextInput, Pressable } from 'react-native';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { DataRow } from '@/components/DataRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { getBackendStatus, type BackendStatus } from '@/lib/api/BackendStatus';
import { getAskMkulimaIntegrationStatus, type AskMkulimaIntegrationStatus } from '@/lib/ai/AskMkulimaIntegration';
import { colors, spacing } from '@/constants/theme';
import { getStrings } from '@/constants/strings';

export default function Settings() {
  const { settings, refresh, saveLanguage, saveMarketChangeThreshold, saveSevereWeatherAlerts } = useAppData();
  const strings = getStrings(settings.language);
  const [saving, setSaving] = useState(false);
  const [backend, setBackend] = useState<BackendStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<AskMkulimaIntegrationStatus | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [thresholdText, setThresholdText] = useState(String(settings.marketChangeThresholdPct));

  useEffect(() => {
    void checkBackend();
  }, []);

  async function toggleLowData(value: boolean) {
    setSaving(true);
    setSaveError(null);
    try {
      await FarmerAppService.setLowDataMode(value);
      await refresh();
    } catch {
      setSaveError('We could not save this preference. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function checkBackend() {
    setCheckingBackend(true);
    setBackendError(null);
    try {
      const [backendStatus, assistantStatus] = await Promise.all([
        getBackendStatus(),
        getAskMkulimaIntegrationStatus()
      ]);
      setBackend(backendStatus);
      setAiStatus(assistantStatus);
    } catch {
      setBackendError('Backend health is currently unavailable. Local data remains available.');
    } finally {
      setCheckingBackend(false);
    }

  }

  async function changeLanguage(language: 'en' | 'sw') {
    setSaving(true);
    try { await saveLanguage(language); } catch { setSaveError('We could not save this preference. Please try again.'); } finally { setSaving(false); }
  }

  async function changeThreshold(value: string) {
    setThresholdText(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      try { await saveMarketChangeThreshold(parsed); } catch { setSaveError('We could not save this preference. Please try again.'); }
    }
  }

  return (
    <AppShell>
      <H2>{strings.settings.title}</H2>
      <Body style={styles.lead}>{settings.language === 'sw' ? 'Chagua lugha ya simu na Uliza Mkulima. Kiswahili cha mkulima, si tafsiri rasmi ya kisheria.' : 'Choose the language for this phone and Ask Mkulima.'}</Body>

      <Card style={{ marginTop: spacing.xl }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <H3>{strings.settings.lowDataMode}</H3>
            <Caption style={{ marginTop: spacing.xs }}>Use lighter network behavior for images, uploads and refreshes where supported.</Caption>
          </View>
          <Switch
            accessibilityLabel="Low-data mode"
            accessibilityHint="Use lighter network behavior for images, uploads and refreshes"
            value={settings.lowDataMode}
            disabled={saving}
            onValueChange={toggleLowData}
            trackColor={{ false: colors.line, true: colors.brandSoft }}
            thumbColor={settings.lowDataMode ? colors.brand : colors.faint}
          />
        </View>
      </Card>
      {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}

      <Card style={{ marginTop: spacing.md }}>
        <DataRow label={strings.settings.language} value={settings.language === 'sw' ? 'Kiswahili' : strings.settings.english} />
        <View style={styles.choiceRow}>
          <Pressable onPress={() => void changeLanguage('en')} style={[styles.choice, settings.language === 'en' && styles.choiceActive]}><Text style={styles.choiceText}>English</Text></Pressable>
          <Pressable onPress={() => void changeLanguage('sw')} style={[styles.choice, settings.language === 'sw' && styles.choiceActive]}><Text style={styles.choiceText}>Kiswahili</Text></Pressable>
        </View>
        <DataRow label={strings.settings.kiswahiliReadiness} value={settings.language === 'sw' ? 'Uliza Mkulima majibu kwa Kiswahili na Kiingereza' : 'Ask Mkulima answers in English and Kiswahili'} last />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <H3>Market alerts</H3>
        <Caption style={{ marginTop: spacing.xs }}>Only flag market movements at or above this percentage.</Caption>
        <View style={styles.thresholdRow}>
          <TextInput value={thresholdText} onChangeText={(value) => void changeThreshold(value)} keyboardType="decimal-pad" style={styles.thresholdInput} accessibilityLabel="Market price-change threshold percentage" />
          <Text style={styles.percent}>%</Text>
        </View>
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <View style={{ flex: 1 }}><H3>Severe-weather alerts</H3><Caption>Receive push alerts when the configured service reports severe weather near your farms.</Caption></View>
          <Switch value={settings.severeWeatherAlerts} onValueChange={(value) => void saveSevereWeatherAlerts(value)} trackColor={{ false: colors.line, true: colors.brandSoft }} thumbColor={settings.severeWeatherAlerts ? colors.brand : colors.faint} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <DataRow label={strings.settings.backendMode} value={backend?.mode ?? 'Checking'} />
        <DataRow label={strings.settings.apiBase} value={backend?.baseUrl ?? 'Local demo'} />
        <DataRow label={strings.settings.health} value={backend?.statusText ?? 'Checking backend health'} />
        <DataRow label="Farm profile from Mkulima" value={backend?.lastProjectionAt ? new Date(backend.lastProjectionAt).toLocaleString() : 'Not received yet'} />
        <DataRow label="What this phone sends" value={backend?.writes ?? 'Evidence envelopes only'} />
        <DataRow label="Ask Mkulima AI" value={aiStatus?.statusText ?? 'Checking AI service'} last />
        {backendError ? <Text accessibilityRole="alert" style={styles.error}>{backendError}</Text> : null}
        <PrimaryButton
          label={checkingBackend ? 'Checking...' : strings.settings.refreshBackend}
          disabled={checkingBackend}
          onPress={checkBackend}
        />
      </Card>

      <Caption style={styles.note}>Sensitive profile and permission changes must use step-up authentication in production.</Caption>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  note: { marginTop: spacing.xxl, textAlign: 'center' },
  error: { marginTop: spacing.md, color: colors.danger, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.sm },
  choiceActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  choiceText: { color: colors.brandDark, fontWeight: '800' },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  thresholdInput: { width: 100, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.sm, color: colors.text },
  percent: { marginLeft: spacing.sm, fontWeight: '800', color: colors.muted }
});
