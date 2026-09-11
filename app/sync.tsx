import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as Network from 'expo-network';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EmptyState } from '@/components/EmptyState';
import { OutboxCard } from '@/components/OutboxCard';
import { useAppData } from '@/context/AppDataContext';
import { syncPending } from '@/lib/sync/syncEngine';
import { colors, spacing } from '@/constants/theme';

export default function Sync() {
  const { outbox, refresh } = useAppData();
  const [running, setRunning] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const pending = outbox.filter((i) => i.state !== 'SYNCED');
  const needsAttention = outbox.filter((i) => i.state === 'FAILED' || i.state === 'CONFLICT').length;

  const checkNetwork = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    } catch {
      setOnline(null);
    }
  }, []);

  useEffect(() => {
    void checkNetwork();
  }, [checkNetwork]);

  async function run() {
    setRunning(true);
    try {
      const result = await syncPending();
      await refresh();
      await checkNetwork();
      if (result.offline) Alert.alert('Offline', 'Your updates remain safely queued on this device.');
      else Alert.alert('Sync complete', `${result.synced} synced - ${result.failed} need attention`);
    } catch {
      Alert.alert('Sync error', 'We could not complete synchronization. Your updates remain safely queued on this device.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <H2>Saved updates</H2>
      <Body style={styles.lead}>Your records stay on this phone first. They sync when you have a connection.</Body>
      <Card accessibilityLabel={online === false ? 'Offline' : online === true ? 'Online' : 'Connection status unknown'} style={{ marginTop: spacing.lg, backgroundColor: online === false ? colors.warm : colors.brandSoft }}>
        <Caption>Connection status</Caption>
        <H3 style={{ marginTop: spacing.sm }}>{online === false ? 'Offline' : online === true ? 'Online' : 'Checking connection...'}</H3>
        <Body style={{ marginTop: spacing.sm }}>{online === false ? 'Updates stay on this phone and will sync when you reconnect.' : online === true ? 'Ready to send saved updates.' : 'Checking your connection.'}</Body>
      </Card>
      <Card style={{ marginTop: spacing.xl, backgroundColor: pending.length ? colors.warm : colors.brandSoft }}>
        <Caption>Waiting to send</Caption>
        <H3 style={{ marginTop: spacing.sm }}>{pending.length} update{pending.length === 1 ? '' : 's'}</H3>
        <Body style={{ marginTop: spacing.sm }}>{pending.length ? 'Saved on this phone. Will sync when you are online.' : 'Everything on this phone is synced.'}</Body>
        {needsAttention ? <Caption style={{ marginTop: spacing.md, color: colors.danger }}>{needsAttention} update{needsAttention === 1 ? '' : 's'} need review after a sync attempt.</Caption> : null}
      </Card>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        {outbox.length ? outbox.map((item) => <OutboxCard key={item.id} item={item} />) : <EmptyState title="No queued updates" body="Production, cost, sale, evidence and correction updates will appear here after they are saved." />}
      </View>
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={running ? 'Syncing...' : 'Sync now'} disabled={running || pending.length === 0} onPress={run} />
      </View>
      <Caption style={{ marginTop: spacing.xl }}>If something cannot be sent, it stays on this phone. You will not lose the record.</Caption>
    </AppShell>
  );
}
const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm }
});
