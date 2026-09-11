import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { FarmerAppService } from '@/application/FarmerAppService';
import { colors, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

export default function Consents() {
  const { consents, refresh } = useAppData();
  const [error, setError] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<string | null>(null);
  async function revoke(id: string, institution: string) {
    Alert.alert('Request to revoke permission?', `This will queue a permission revocation for ${institution}. Production should re-authenticate before sensitive consent changes.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Request revocation',
        style: 'destructive',
        onPress: async () => {
          setRevoking(id);
          setError(null);
          try {
            await FarmerAppService.requestConsentRevocation(id);
            await refresh();
          } catch {
            setError(`We could not submit the revocation request for ${institution}. Your current permission remains unchanged.`);
          } finally {
            setRevoking(null);
          }
        }
      }
    ]);
  }

  return (
    <AppShell>
      <H2>Shared With</H2>
      <Body style={styles.lead}>See who can use parts of your Mkulima Passport, what they can access, and why.</Body>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        {consents.length ? consents.map((consent) => (
          <Card key={consent.id} accessibilityLabel={`${consent.institution} permission, ${consent.status}`}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                  <Caption>Shared with</Caption>
                  <H3>{consent.institution}</H3>
                <Caption>{consent.purpose}</Caption>
              </View>
              <StatusPill label={consent.status === 'active' ? 'Connected' : consent.status === 'pending' ? 'Connection pending' : consent.status === 'revoked' ? 'Sharing stopped' : consent.status} tone={consent.status === 'active' ? 'verified' : consent.status === 'pending' ? 'attention' : 'neutral'} />
            </View>
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {consent.scopes.map((scope) => (
                <View key={scope} style={styles.scopeRow}>
                  <Text accessibilityLabel="Permission granted" style={styles.check}>OK</Text>
                  <Body style={{ flex: 1 }}>{scope}</Body>
                </View>
              ))}
            </View>
            {consent.expiresAt ? <Caption style={{ marginTop: spacing.lg }}>Expires {formatDate(consent.expiresAt)}</Caption> : null}
            {consent.status === 'active' ? (
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton label={revoking === consent.id ? 'Requesting...' : 'Manage access'} disabled={revoking !== null} variant="secondary" onPress={() => revoke(consent.id, consent.institution)} />
              </View>
            ) : null}
          </Card>
        )) : <EmptyState title="No shared access" body="No institution is currently shown as having access to your Mkulima Passport." />}
      </View>
      <Caption style={styles.note}>Access changes are recorded for audit. The app does not silently delete prior permission history.</Caption>
    </AppShell>
  );
}
const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { minWidth: 28, color: colors.success, fontWeight: '900', fontSize: 11 },
  note: { marginTop: spacing.xxxl, textAlign: 'center' },
  error: { marginTop: spacing.lg, color: colors.danger, fontWeight: '700' }
});
